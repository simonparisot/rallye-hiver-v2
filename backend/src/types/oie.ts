/**
 * Types for the "jeu de l'oie" enigma (edition 2027, theme: le theatre).
 *
 * This enigma is an isolated experiment: every type it needs lives here rather
 * than in types/index.ts, so that removing the feature stays a matter of
 * deleting a directory and a handful of serverless entries.
 *
 * Board numbering: square 0 is the start (no question), square 63 is the
 * finish and must be reached exactly.
 */

/** Kind of square, which decides what happens when a team lands on it. */
export type OieSquareType =
  | 'depart' // 0
  | 'normale'
  | 'oie' // 9, 18, 27, 36, 45, 54: l'acteur sur son oie, on rejoue
  | 'souffleur' // 14, 39, 50, 60: la question dispose d'un indice
  | 'loge' // 19: passer un tour
  | 'puits' // 31: bloque jusqu'a ce qu'une autre equipe y tombe
  | 'prison' // 52: passer deux tours, sauf si une autre equipe y tombe
  | 'mort' // 58: la repetition, retour a la case 0
  | 'arrivee'; // 63

/** One square of the board, as configured by the admin. */
export interface OieSquare {
  squareNumber: number; // 0..63
  type: OieSquareType; // derived from the number, stored for readability
  question?: string; // absent on square 0 and 63
  acceptedAnswers: string[]; // compared after normalisation
  hint?: string; // only meaningful on a "souffleur" square
  flavor?: string; // short mood text, shown next to the question
}

/**
 * The whole board configuration, kept as a single DynamoDB item.
 * 64 squares with short questions stay far below the 400 KB item limit.
 */
export interface OieBoardConfig {
  boardId: string; // always 'default': a single shared board
  squares: OieSquare[];
  rollsPerDay: number; // global quota, admin adjustable at any time
  /**
   * Id of the ordinary Enigma this board stands for. Reaching square 63 marks
   * that enigma solved, so the existing leaderboard and statistics count it.
   * Kept here rather than in an environment variable so that the admin can set
   * it without a deployment.
   */
  enigmaId?: string;
  updatedAt: string;
  updatedBy?: string; // admin userId
}

/**
 * Status shown to the player. Derived from the state fields below; it never
 * drives the rules, it only names the situation for the interface.
 */
export type OieTeamStatus =
  | 'question_en_attente' // must answer before being allowed to roll again
  | 'peut_lancer' // may roll right now
  | 'quota_epuise' // has answered but used every roll of the day
  | 'tour_passe' // loge or prison penalty still running
  | 'dans_le_puits' // waiting for another team to fall in
  | 'arrivee'; // reached 63

/** Per team state of the shared board. */
export interface OieTeamState {
  teamId: string;
  position: number; // 0..63
  questionPending: boolean; // a question of the current square awaits an answer
  inPuits: boolean; // stuck on 31 until another team lands there
  inPrison: boolean; // serving the 52 penalty, releasable by another team
  /**
   * Day (YYYY-MM-DD, Europe/Paris) from which the team may roll again.
   * This is how "passer un tour" is modelled: landing on the loge on day D
   * sets it to D+2, the prison to D+3. Releasing a team from prison sets it
   * back to the current day.
   */
  nextRollAllowedDay: string;
  rollsUsedToday: number; // rolls consumed during rollsDay
  rollsDay: string; // day the counter above refers to (Europe/Paris)
  totalRolls: number;
  wrongAnswers: number;
  hintedSquares: number[]; // squares whose souffleur hint was requested
  overshootCount: number; // times the team failed to land exactly on 63
  finishedAt?: string; // ISO 8601, set when the team reaches 63
  finishRank?: number; // 1 for the first team to arrive
  createdAt: string;
  updatedAt: string;
  /** Incremented on every write, used for conditional updates. */
  version: number;
}

/** Everything that happens on the board, for the feed and for the analysis. */
export type OieEventType =
  | 'lancer'
  | 'deplacement'
  | 'reponse_juste'
  | 'reponse_fausse'
  | 'case_speciale'
  | 'liberation'
  | 'souffleur'
  | 'arrivee'
  | 'reinitialisation';

export interface OieEvent {
  boardId: string; // partition key, always 'default'
  eventKey: string; // sort key: `${occurredAt}#${eventId}`
  eventId: string;
  type: OieEventType;
  teamId: string;
  teamName: string;
  userId?: string;
  occurredAt: string; // ISO 8601
  /** Ready to display sentence, in French, e.g. "Les Orcades tombent dans le puits". */
  message: string;
  /** Structured detail, never shown as is: dice, positions, square type. */
  detail?: Record<string, any>;
}

/** One step of a move, used to narrate the result of a roll. */
export type OieMoveEffect =
  | { kind: 'avance'; from: number; to: number }
  | { kind: 'oie'; at: number; total: number }
  | { kind: 'rebond'; from: number; to: number; depassement: number }
  | { kind: 'metteur_en_scene'; from: number; to: number }
  | { kind: 'mort'; from: number; to: number }
  | { kind: 'puits'; at: number }
  | { kind: 'prison'; at: number }
  | { kind: 'loge'; at: number }
  | { kind: 'souffleur'; at: number }
  | { kind: 'arrivee'; at: number };

/** Result of applying a roll to a position, computed by the pure rules module. */
export interface OieMoveResult {
  position: number;
  finished: boolean;
  overshootCount: number;
  inPuits: boolean;
  inPrison: boolean;
  /** Number of whole days of roll the team forfeits (loge: 1, prison: 2). */
  skippedDays: number;
  effects: OieMoveEffect[];
}
