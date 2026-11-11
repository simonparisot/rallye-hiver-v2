import { getAllEnigmasForAdmin, getAllTeamProgress } from './dynamodb';
import { hasUsablePassword } from './password';

/**
 * Déblocage des tournées par les intrigues.
 *
 * Une tournée sans intrigue requise est ouverte à toutes les équipes. Sinon,
 * elle s'ouvre quand l'équipe a résolu toutes les intrigues que l'organisateur
 * a cochées.
 *
 * L'accès est recalculé à chaque lecture depuis la progression de l'équipe,
 * plutôt que lu dans les enregistrements de déblocage : si l'organisateur
 * change la liste en cours de rallye, la règle s'applique aussitôt, dans un
 * sens comme dans l'autre.
 */

export interface RequiredEnigmaStatus {
  enigmaId: string;
  enigmaNumber: number;
  title: string;
  solved: boolean;
}

export interface ParcoursAccess {
  isUnlocked: boolean;
  requiredEnigmas: RequiredEnigmaStatus[];
}

export interface AccessContext {
  enigmasById: Map<string, { enigmaNumber: number; title: string; isActive: boolean }>;
  solvedEnigmaIds: Set<string>;
}

export async function loadAccessContext(teamId: string): Promise<AccessContext> {
  const [enigmas, progress] = await Promise.all([
    getAllEnigmasForAdmin(),
    getAllTeamProgress(teamId),
  ]);

  return {
    enigmasById: new Map(
      enigmas.map((e: any) => [
        e.enigmaId,
        { enigmaNumber: e.enigmaNumber, title: e.title, isActive: e.isActive === true },
      ])
    ),
    solvedEnigmaIds: new Set(
      progress.filter((p: any) => p.solved).map((p: any) => p.enigmaId)
    ),
  };
}

export function evaluateParcoursAccess(parcours: any, context: AccessContext): ParcoursAccess {
  // Une intrigue supprimée depuis ne peut plus être résolue : la garder dans
  // la liste verrouillerait la tournée pour toujours.
  const requiredEnigmas = (parcours.requiredEnigmaIds || [])
    .filter((id: string) => context.enigmasById.has(id))
    .map((id: string) => {
      const enigma = context.enigmasById.get(id)!;
      return {
        enigmaId: id,
        enigmaNumber: enigma.enigmaNumber,
        // Le titre d'une intrigue pas encore publiée ne doit pas fuiter.
        title: enigma.isActive ? enigma.title : 'Intrigue à venir',
        solved: context.solvedEnigmaIds.has(id),
      };
    })
    .sort((a: RequiredEnigmaStatus, b: RequiredEnigmaStatus) => a.enigmaNumber - b.enigmaNumber);

  return {
    isUnlocked: requiredEnigmas.every((e: RequiredEnigmaStatus) => e.solved),
    requiredEnigmas,
  };
}

/**
 * Ce qu'un joueur peut voir d'une tournée.
 *
 * Jamais le mot de passe de fin de tournée : seulement `hasPassword`, pour
 * savoir s'il peut déjà la valider. L'adresse du PDF, qui suffit à l'ouvrir,
 * seulement si `withPdf` (tournée ouverte pour son équipe).
 */
export function forPlayers(parcours: any, { withPdf = false }: { withPdf?: boolean } = {}) {
  const { pdfUrl, correctPassword, ...rest } = parcours;
  return {
    ...rest,
    ...(withPdf && pdfUrl !== undefined ? { pdfUrl } : {}),
    hasPassword: hasUsablePassword(correctPassword),
  };
}

/**
 * Valide la liste d'intrigues envoyée par l'administration et renvoie celle à
 * enregistrer, ou un message d'erreur.
 *
 * Un identifiant inconnu est refusé s'il est nouveau. S'il figurait déjà dans
 * la liste enregistrée (`previousIds`), c'est une intrigue supprimée depuis :
 * il est retiré sans erreur, sinon la tournée ne pourrait plus être modifiée,
 * même pour la dépublier.
 */
export async function resolveRequiredEnigmaIds(
  ids: unknown,
  previousIds: string[] = []
): Promise<{ error: string; ids?: undefined } | { error: null; ids: string[] }> {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return { error: 'requiredEnigmaIds doit être une liste d\'identifiants d\'intrigues' };
  }
  if (ids.length === 0) return { error: null, ids: [] };

  const enigmas = await getAllEnigmasForAdmin();
  const known = new Set(enigmas.map((e: any) => e.enigmaId));
  const previous = new Set(previousIds);
  const unknown = ids.filter((id) => !known.has(id) && !previous.has(id));
  if (unknown.length > 0) {
    return { error: `Intrigues inconnues : ${unknown.join(', ')}` };
  }
  return { error: null, ids: Array.from(new Set(ids.filter((id) => known.has(id)))) };
}

/**
 * Valide une liste d'intrigues pour une nouvelle tournée. Renvoie un message
 * d'erreur, ou null si la liste est acceptable.
 */
export async function validateRequiredEnigmaIds(ids: unknown): Promise<string | null> {
  return (await resolveRequiredEnigmaIds(ids)).error;
}
