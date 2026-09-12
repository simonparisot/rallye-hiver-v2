import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// randomUUID plutot que le paquet uuid : il est natif a Node 20 et, contrairement
// a uuid v13 qui n'est publie qu'en ESM, il se charge dans les tests unitaires.
import { randomUUID } from 'crypto';
import {
  getEnigmaById,
  getUserById,
  getTeamById,
  getTeamProgress,
  createOrUpdateTeamProgress,
  createHintRequest,
  getHintRequestsByTeamAndEnigma,
} from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { nextHintCost } from '../../utils/hintCost';
import { selectHint, HintSelectionError, ModelCaller } from '../../services/hintSelector';
import { EnigmaHint } from '../../types';

/**
 * Demande d'indice par une equipe.
 *
 * POST /hints/{enigmaId}/request
 * Corps : { progress: string, requestKey?: string }
 *
 * L'equipe decrit librement son avancement ; un modele choisit, parmi les
 * indices pre-ecrits de l'enigme, celui qui correspond le mieux. Rien de ce que
 * le modele redige n'atteint le joueur : seul le texte pre-ecrit est renvoye.
 */

export const PROGRESS_MIN = 20;
export const PROGRESS_MAX = 3000;

/** Verrous en cours, pour absorber un double clic (voir plus bas). */
const verrous = new Map<string, number>();
const DUREE_VERROU_MS = 60_000;

function poserVerrou(cle: string): boolean {
  const maintenant = Date.now();
  // Nettoyage opportuniste : le conteneur lambda est reutilise, la carte ne doit
  // pas grossir indefiniment.
  for (const [k, expiration] of verrous) {
    if (expiration <= maintenant) verrous.delete(k);
  }
  if (verrous.has(cle)) {
    return false;
  }
  verrous.set(cle, maintenant + DUREE_VERROU_MS);
  return true;
}

function leverVerrou(cle: string) {
  verrous.delete(cle);
}

/** Normalise et trie les indices declares sur l'enigme. */
export function ordonnerIndices(hints: any): EnigmaHint[] {
  if (!Array.isArray(hints)) return [];
  return hints
    .filter((h: any) => h && typeof h.id === 'string' && typeof h.text === 'string')
    .map((h: any) => ({ id: h.id, order: Number(h.order) || 0, text: h.text }))
    .sort((a, b) => a.order - b.order);
}

export const handler = async (
  event: APIGatewayProxyEvent,
  // Injectable pour les tests : l'appel reel au modele reste le defaut.
  caller?: ModelCaller
): Promise<APIGatewayProxyResult> => {
  let cleVerrou: string | null = null;

  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) {
      return error('Unauthorized', 401);
    }

    const enigmaId = event.pathParameters?.enigmaId;
    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    let body: any;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Corps de requete invalide', 400);
    }

    const progress = typeof body.progress === 'string' ? body.progress.trim() : '';
    if (progress.length < PROGRESS_MIN) {
      return error(
        `Decrivez votre avancement en au moins ${PROGRESS_MIN} caracteres : plus le texte est precis, plus l'indice sera adapte.`,
        400
      );
    }
    if (progress.length > PROGRESS_MAX) {
      return error(`Votre description depasse ${PROGRESS_MAX} caracteres. Resumez-la.`, 400);
    }

    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('Vous devez appartenir a une equipe pour demander un indice', 403);
    }

    const team = await getTeamById(user.teamId);
    if (!team) {
      return error('Team not found', 404);
    }
    if (!team.hasPaid) {
      return error("Votre equipe doit avoir regle son inscription pour demander un indice", 403);
    }

    const enigma = await getEnigmaById(enigmaId);
    if (!enigma) {
      return error('Enigma not found', 404);
    }
    if (!enigma.isActive) {
      return error("Cette enigme n'est pas active", 403);
    }

    const progression = await getTeamProgress(user.teamId, enigmaId);
    if (progression?.solved) {
      return error('Votre equipe a deja resolu cette enigme', 409);
    }

    const tousLesIndices = ordonnerIndices(enigma.hints);
    if (tousLesIndices.length === 0) {
      return error("Aucun indice n'est disponible pour cette enigme", 404);
    }

    const demandesPassees = await getHintRequestsByTeamAndEnigma(user.teamId, enigmaId);
    const idsDejaDonnes = new Set(demandesPassees.map((d: any) => d.hintId));
    const dejaDonnes = tousLesIndices.filter((h) => idsDejaDonnes.has(h.id));
    const disponibles = tousLesIndices.filter((h) => !idsDejaDonnes.has(h.id));

    if (disponibles.length === 0) {
      return error(
        "Votre equipe a deja obtenu tous les indices disponibles pour cette enigme.",
        409
      );
    }

    // Idempotence : deux clics sur le meme bouton arrivent a quelques
    // millisecondes d'intervalle et partagent la meme cle de requete. Le verrou
    // vit dans le conteneur lambda, ce qui suffit pour ce cas-la ; il n'a pas
    // vocation a coordonner deux conteneurs concurrents.
    const cleClient = typeof body.requestKey === 'string' ? body.requestKey.slice(0, 100) : '';
    cleVerrou = `${user.teamId}#${enigmaId}#${cleClient}`;
    if (!poserVerrou(cleVerrou)) {
      cleVerrou = null; // le verrou appartient a l'appel precedent, ne pas le lever
      return error('Une demande est deja en cours pour cette enigme. Patientez quelques secondes.', 409);
    }

    const cout = nextHintCost(enigma.points || 0, dejaDonnes.length);

    const choix = await selectHint(
      {
        enigmaTitle: enigma.title,
        enigmaDescription: enigma.description,
        solution: enigma.solution || '',
        correctPassword: enigma.correctPassword,
        availableHints: disponibles,
        alreadyGivenHints: dejaDonnes,
        progressText: progress,
      },
      caller
    );

    const maintenant = new Date().toISOString();
    const hintsRequested = dejaDonnes.length + 1;

    await createHintRequest({
      requestId: randomUUID(),
      teamId: user.teamId,
      enigmaId,
      // Cle composite de l'index secondaire, sur le modele des tentatives de mot de passe
      teamEnigmaKey: `${user.teamId}#${enigmaId}`,
      requestedAt: maintenant,
      requestedBy: userId,
      progressText: progress,
      hintId: choix.hint.id,
      hintText: choix.hint.text,
      justification: choix.justification,
      model: choix.model,
      inputTokens: choix.inputTokens,
      outputTokens: choix.outputTokens,
      pointsCharged: cout,
    });

    const majProgression: any = {
      hintsRequested,
      lastHintAt: maintenant,
      updatedAt: maintenant,
    };
    if (!progression) {
      majProgression.solved = false;
      majProgression.attemptCount = 0;
      majProgression.createdAt = maintenant;
    }
    await createOrUpdateTeamProgress(user.teamId, enigmaId, majProgression);

    return success({
      hint: { id: choix.hint.id, text: choix.hint.text },
      pointsCharged: cout,
      hintsRequested,
      remainingHints: disponibles.length - 1,
      nextHintCost: nextHintCost(enigma.points || 0, hintsRequested),
    });
  } catch (err: any) {
    if (err instanceof HintSelectionError) {
      // Aucun point facture, aucune demande archivee : l'equipe peut reessayer.
      console.error('Choix d\'indice en echec:', err.message);
      return error(
        "Le choix de l'indice n'a pas abouti. Aucun point ne vous a ete retire : reessayez dans un instant.",
        502
      );
    }
    console.error('Error requesting hint:', err);
    return error(err.message || 'Failed to request hint');
  } finally {
    if (cleVerrou) leverVerrou(cleVerrou);
  }
};
