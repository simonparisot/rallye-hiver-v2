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
import { selectHint, HintSelectionError, ModelCaller } from '../../services/hintSelector';
import { EnigmaHint } from '../../types';

/**
 * Demande d'indice par une équipe.
 *
 * POST /hints/{enigmaId}/request
 * Corps : { progress: string, requestKey?: string }
 *
 * Deux modes, choisis par HINT_PROVIDER :
 *
 * - `anthropic` : la lambda appelle l'API et répond 200 avec l'indice. C'est le
 *   mode de production, celui qui suppose une clé d'API.
 * - `queue` : la lambda n'appelle aucun modèle. Elle enregistre la demande en
 *   attente et répond 202 ; un worker extérieur, lancé sur la machine du
 *   commanditaire, la traite en passant par son abonnement Claude. C'est le mode
 *   de l'essai, où il n'existe pas de clé d'API.
 *
 * Dans les deux cas, le joueur ne voit qu'un statut : le frontend ignore quel
 * mode tourne, il interroge jusqu'à ce que la demande soit conclue.
 */

export const PROGRESS_MIN = 20;
export const PROGRESS_MAX = 3000;

/** Fournisseur actif. Tout ce qui n'est pas `queue` est l'appel direct. */
export function hintProvider(): 'anthropic' | 'queue' {
  return process.env.HINT_PROVIDER === 'queue' ? 'queue' : 'anthropic';
}

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
        `Décrivez votre avancement en au moins ${PROGRESS_MIN} caractères : plus le texte est précis, plus l'indice sera adapté.`,
        400
      );
    }
    if (progress.length > PROGRESS_MAX) {
      return error(`Votre description dépasse ${PROGRESS_MAX} caractères. Résumez-la.`, 400);
    }

    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('Vous devez appartenir à une équipe pour demander un indice', 403);
    }

    const team = await getTeamById(user.teamId);
    if (!team) {
      return error('Team not found', 404);
    }
    if (!team.hasPaid) {
      return error("Votre équipe doit avoir réglé son inscription pour demander un indice", 403);
    }

    const enigma = await getEnigmaById(enigmaId);
    if (!enigma) {
      return error('Enigma not found', 404);
    }
    if (!enigma.isActive) {
      return error("Cette énigme n'est pas active", 403);
    }

    const progression = await getTeamProgress(user.teamId, enigmaId);
    if (progression?.solved) {
      return error('Votre équipe a déjà résolu cette énigme', 409);
    }

    const tousLesIndices = ordonnerIndices(enigma.hints);
    if (tousLesIndices.length === 0) {
      return error("Aucun indice n'est disponible pour cette énigme", 404);
    }

    const demandesPassees = await getHintRequestsByTeamAndEnigma(user.teamId, enigmaId);

    // Une demande encore en vol interdit d'en lancer une seconde : sans cela une
    // équipe impatiente empilerait les demandes pendant que le worker travaille.
    const enCours = demandesPassees.find(
      (d: any) => d.status === 'pending' || d.status === 'processing'
    );
    if (enCours) {
      return error(
        "Une demande est déjà en cours pour cette énigme. Laissez-lui le temps d'aboutir.",
        409
      );
    }

    // Seules les demandes abouties consomment un indice : une demande échouée
    // n'a rien livré, l'indice reste disponible.
    const idsDejaDonnes = new Set(
      demandesPassees.filter((d: any) => d.status === 'done' && d.hintId).map((d: any) => d.hintId)
    );
    const dejaDonnes = tousLesIndices.filter((h) => idsDejaDonnes.has(h.id));
    const disponibles = tousLesIndices.filter((h) => !idsDejaDonnes.has(h.id));

    if (disponibles.length === 0) {
      return error(
        "Votre équipe a déjà obtenu tous les indices disponibles pour cette énigme.",
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
      return error('Une demande est déjà en cours pour cette énigme. Patientez quelques secondes.', 409);
    }

    const requestId = randomUUID();
    const maintenant = new Date().toISOString();

    // Le coût est nul pendant l'essai : le commanditaire veut d'abord juger le
    // mécanisme de choix. Le barème dort dans utils/hintCost.ts.
    const cout = 0;

    const demandeCommune = {
      requestId,
      teamId: user.teamId,
      enigmaId,
      // Cle composite de l'index secondaire, sur le modele des tentatives de mot de passe
      teamEnigmaKey: `${user.teamId}#${enigmaId}`,
      requestedAt: maintenant,
      requestedBy: userId,
      progressText: progress,
      excludedHintIds: dejaDonnes.map((h) => h.id),
      pointsCharged: cout,
    };

    if (hintProvider() === 'queue') {
      // Aucun appel au modèle ici : la demande part en attente et le worker la
      // prendra. La réponse est un accusé de réception, pas un indice.
      await createHintRequest({ ...demandeCommune, status: 'pending' });

      await majProgression(user.teamId, enigmaId, progression, dejaDonnes.length + 1, maintenant);

      return success(
        {
          requestId,
          status: 'pending',
          pointsCharged: cout,
          hintsRequested: dejaDonnes.length + 1,
          remainingHints: disponibles.length,
        },
        202
      );
    }

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

    const conclu = new Date().toISOString();

    await createHintRequest({
      ...demandeCommune,
      status: 'done',
      hintId: choix.hint.id,
      hintText: choix.hint.text,
      justification: choix.justification,
      model: choix.model,
      inputTokens: choix.inputTokens,
      outputTokens: choix.outputTokens,
      completedAt: conclu,
    });

    await majProgression(user.teamId, enigmaId, progression, dejaDonnes.length + 1, conclu);

    return success({
      requestId,
      status: 'done',
      hint: { id: choix.hint.id, text: choix.hint.text },
      pointsCharged: cout,
      hintsRequested: dejaDonnes.length + 1,
      remainingHints: disponibles.length - 1,
    });
  } catch (err: any) {
    if (err instanceof HintSelectionError) {
      // Aucune demande archivee comme reussie : l'equipe peut reessayer.
      console.error("Choix d'indice en échec:", err.message);
      return error(
        "Le choix de l'indice n'a pas abouti. Réessayez dans un instant.",
        502
      );
    }
    console.error('Error requesting hint:', err);
    return error(err.message || 'Failed to request hint');
  } finally {
    if (cleVerrou) leverVerrou(cleVerrou);
  }
};

/** Compteur d'indices de l'équipe sur cette énigme. */
async function majProgression(
  teamId: string,
  enigmaId: string,
  progression: any,
  hintsRequested: number,
  quand: string
) {
  const updates: any = {
    hintsRequested,
    lastHintAt: quand,
    updatedAt: quand,
  };
  if (!progression) {
    updates.solved = false;
    updates.attemptCount = 0;
    updates.createdAt = quand;
  }
  await createOrUpdateTeamProgress(teamId, enigmaId, updates);
}
