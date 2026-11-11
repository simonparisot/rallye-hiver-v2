import { getAllEnigmasForAdmin, getAllTeamProgress } from './dynamodb';

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
  enigmasById: Map<string, { enigmaNumber: number; title: string }>;
  solvedEnigmaIds: Set<string>;
}

export async function loadAccessContext(teamId: string): Promise<AccessContext> {
  const [enigmas, progress] = await Promise.all([
    getAllEnigmasForAdmin(),
    getAllTeamProgress(teamId),
  ]);

  return {
    enigmasById: new Map(
      enigmas.map((e: any) => [e.enigmaId, { enigmaNumber: e.enigmaNumber, title: e.title }])
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
        title: enigma.title,
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
 * Ce qu'un joueur peut voir d'une tournée sans y avoir accès : tout sauf
 * l'adresse de son PDF, qui suffirait à l'ouvrir.
 */
export function withoutPdf(parcours: any) {
  const { pdfUrl, ...rest } = parcours;
  return rest;
}

/**
 * Valide la liste d'intrigues envoyée par l'administration. Renvoie un message
 * d'erreur, ou null si la liste est acceptable.
 */
export async function validateRequiredEnigmaIds(ids: unknown): Promise<string | null> {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return 'requiredEnigmaIds doit être une liste d\'identifiants d\'intrigues';
  }
  if (ids.length === 0) return null;

  const enigmas = await getAllEnigmasForAdmin();
  const known = new Set(enigmas.map((e: any) => e.enigmaId));
  const unknown = ids.filter((id) => !known.has(id));
  return unknown.length > 0 ? `Intrigues inconnues : ${unknown.join(', ')}` : null;
}
