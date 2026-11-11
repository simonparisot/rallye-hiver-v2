import { getGameStatus, getUserById, getTeamById } from './dynamodb';

/**
 * Phase du jeu : avant le lancement officiel, ou lancé.
 *
 * C'est le serveur qui la calcule, et lui seul : chaque route qui sert une
 * intrigue, une tournée ou un PDF la relit ici. Le frontend la reçoit par
 * GET /game/status et ne fait que l'afficher.
 *
 * Le jeu est lancé si l'organisateur l'a lancé (`isStarted` dans l'item de
 * statut) OU si l'heure de lancement est passée. Le lancement se fait donc
 * tout seul à l'heure dite, même si personne n'appuie sur le bouton, et
 * l'organisateur peut l'avancer. Il peut aussi revenir en avant-lancement
 * (POST /admin/game/reset), ce qui n'a d'effet qu'avant l'heure de lancement.
 *
 * Avant le lancement, seules les intrigues préliminaires (`isPreliminary`)
 * existent pour les joueurs ; après, elles disparaissent et les vraies
 * intrigues et les tournées apparaissent.
 */

export type GamePhase = 'avant-lancement' | 'lance';

/**
 * Heure du lancement officiel de l'édition 2027 : celle de `startsAt` dans
 * frontend/src/editions/2027.ts. Une constante plutôt qu'un réglage en base :
 * elle ne change pas d'ici au lancement, elle se relit dans le code et dans
 * l'historique git, et aucune écriture en base n'est nécessaire pour qu'elle
 * s'applique. L'item de statut peut toutefois la remplacer (`launchAt`),
 * posé par POST /admin/game/reset : c'est la soupape pour décaler le
 * lancement sans redéployer, ou pour rejouer l'avant-lancement sur test après
 * la date.
 */
export const DATE_LANCEMENT_PAR_DEFAUT = '2026-12-21T21:50:00+01:00';

export interface EtatJeu {
  /** Phase globale, la même pour tous (hors équipes bêta). */
  phase: GamePhase;
  /** Heure de lancement en vigueur, ISO 8601. */
  launchAt: string;
  /** Lancé par l'organisateur (bouton), indépendamment de l'heure. */
  isStarted: boolean;
  startedAt: string | null;
}

/** Une date ISO lisible, ou null. */
function dateValide(valeur: unknown): string | null {
  if (typeof valeur !== 'string' || valeur.trim() === '') return null;
  return Number.isNaN(Date.parse(valeur)) ? null : valeur;
}

/** L'heure de lancement en vigueur pour cet item de statut. */
export function dateLancement(statut: { launchAt?: unknown } | null | undefined): string {
  return dateValide(statut?.launchAt) ?? DATE_LANCEMENT_PAR_DEFAUT;
}

/** Calcul pur de la phase, à partir de l'item de statut (absent = rien de posé). */
export function calculerPhase(
  statut: { isStarted?: unknown; launchAt?: unknown } | null | undefined,
  maintenant: Date = new Date()
): GamePhase {
  if (statut?.isStarted === true) return 'lance';
  return maintenant.getTime() >= Date.parse(dateLancement(statut)) ? 'lance' : 'avant-lancement';
}

/** Lit l'item de statut et en tire l'état du jeu. Un item absent vaut « rien de posé ». */
export async function lireEtatJeu(maintenant: Date = new Date()): Promise<EtatJeu> {
  const statut: any = await getGameStatus();
  return {
    phase: calculerPhase(statut, maintenant),
    launchAt: dateLancement(statut),
    isStarted: statut?.isStarted === true,
    startedAt: statut?.startedAt || null,
  };
}

/**
 * La phase telle que la vit une équipe. Une équipe bêta (`isBetaTeam`) joue
 * avant l'ouverture, comme depuis 2025 : elle voit le jeu lancé. C'est le cas
 * de l'équipe des tests automatiques.
 */
export function phasePourEquipe(phase: GamePhase, team: { isBetaTeam?: boolean } | null | undefined): GamePhase {
  return team?.isBetaTeam === true ? 'lance' : phase;
}

/**
 * La phase pour l'utilisateur connecté. Les lectures de l'utilisateur et de
 * l'équipe ne sont faites qu'avant le lancement : après, la réponse est la
 * même pour tous.
 */
export async function phasePourUtilisateur(userId: string | undefined | null): Promise<GamePhase> {
  const { phase } = await lireEtatJeu();
  if (phase === 'lance' || !userId) return phase;
  const user: any = await getUserById(userId);
  if (!user?.teamId) return phase;
  const team: any = await getTeamById(user.teamId);
  return phasePourEquipe(phase, team);
}

/** L'intrigue est-elle une préliminaire ? */
export function estPreliminaire(enigma: { isPreliminary?: unknown } | null | undefined): boolean {
  return enigma?.isPreliminary === true;
}

/**
 * Une intrigue publiée est-elle ouverte aux joueurs dans cette phase ?
 * Les préliminaires avant le lancement, les vraies intrigues après.
 */
export function intrigueOuverte(enigma: { isPreliminary?: unknown } | null | undefined, phase: GamePhase): boolean {
  return estPreliminaire(enigma) ? phase === 'avant-lancement' : phase === 'lance';
}

/**
 * Le thème officiel est-il débloqué ? Pour tous une fois le jeu lancé, et,
 * avant, pour une équipe qui a résolu une préliminaire (`themeUnlockedAt`,
 * posé par POST /progress/attempt).
 */
export function themeOfficielDebloque(
  phase: GamePhase,
  team: { themeUnlockedAt?: unknown } | null | undefined
): boolean {
  return phase === 'lance' || (typeof team?.themeUnlockedAt === 'string' && team.themeUnlockedAt !== '');
}

/** Identifiants des préliminaires parmi une liste d'intrigues (lue en entier). */
export function idsPreliminaires(enigmas: any[]): Set<string> {
  return new Set(enigmas.filter((e) => estPreliminaire(e)).map((e) => e.enigmaId));
}

/** Retire les lignes (tentatives, progression) qui portent sur une préliminaire. */
export function sansPreliminaires<T extends { enigmaId?: string }>(rows: T[], preliminaires: Set<string>): T[] {
  if (preliminaires.size === 0) return rows;
  return rows.filter((row) => !row.enigmaId || !preliminaires.has(row.enigmaId));
}
