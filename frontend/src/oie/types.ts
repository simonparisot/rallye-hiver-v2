/**
 * Types du jeu de l'oie cote navigateur.
 *
 * Ils decrivent ce que le serveur envoie, rien de plus : aucune regle n'est
 * evaluee ici. Le navigateur affiche un etat, il ne le calcule pas.
 */

export type OieSquareType =
  | 'depart'
  | 'normale'
  | 'oie'
  | 'souffleur'
  | 'loge'
  | 'puits'
  | 'prison'
  | 'mort'
  | 'arrivee';

export type OieTeamStatus =
  | 'question_en_attente'
  | 'peut_lancer'
  | 'quota_epuise'
  | 'tour_passe'
  | 'dans_le_puits'
  | 'arrivee';

/** Case telle que la voient les joueurs : sans question ni reponse. */
export interface OieSquareView {
  squareNumber: number;
  type: OieSquareType;
  hasQuestion: boolean;
  hasHint: boolean;
}

export interface OieBoardView {
  rollsPerDay: number;
  squares: OieSquareView[];
}

/** Pion d'une equipe sur le plateau partage. */
export interface OieTeamPawn {
  teamId: string;
  teamName: string;
  position: number;
  status: OieTeamStatus;
  inPuits: boolean;
  inPrison: boolean;
  finishedAt?: string;
  finishRank?: number;
  isMine: boolean;
}

/** Carte d'action de mon equipe. */
export interface OieMyView {
  teamId: string;
  teamName: string;
  position: number;
  squareType: OieSquareType;
  flavor?: string;
  status: OieTeamStatus;
  questionPending: boolean;
  question?: string;
  hintAvailable: boolean;
  hintRequested: boolean;
  hint?: string;
  canRoll: boolean;
  rollRefusal: string | null;
  rollsRemainingToday: number;
  rollsPerDay: number;
  inPuits: boolean;
  inPrison: boolean;
  blockedDaysLeft: number;
  nextRollAllowedDay: string;
  totalRolls: number;
  wrongAnswers: number;
  overshootCount: number;
  finishedAt?: string;
  finishRank?: number;
}

export interface OieEventView {
  eventId: string;
  type: string;
  teamId: string;
  teamName: string;
  occurredAt: string;
  message: string;
}

export interface OieBoardResponse {
  board: OieBoardView;
  today: string;
  teams: OieTeamPawn[];
  me: OieMyView;
  events: OieEventView[];
}

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

export interface OieRollResponse extends OieBoardResponse {
  dice: [number, number];
  total: number;
  from: number;
  to: number;
  finished: boolean;
  effects: OieMoveEffect[];
  /** Phrases deja ecrites en francais, dans l'ordre des effets. */
  journal: string[];
  /** Equipes repechees par ce lancer. */
  releases: string[];
}

export interface OieAnswerResponse extends OieBoardResponse {
  correct: boolean;
  message: string;
}

export interface OiePrompterResponse {
  squareNumber: number;
  hint: string;
  firstTime: boolean;
}

// ==================== ADMINISTRATION ====================

/** Case telle que l'admin la configure : question, reponses et indice compris. */
export interface OieSquareAdmin {
  squareNumber: number;
  type: OieSquareType;
  question?: string;
  acceptedAnswers: string[];
  hint?: string;
  flavor?: string;
}

export interface OieBoardAdmin {
  boardId: string;
  squares: OieSquareAdmin[];
  rollsPerDay: number;
  enigmaId?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface OieAdminTeam {
  teamId: string;
  teamName: string;
  isTestTeam: boolean;
  position: number;
  status: OieTeamStatus;
  questionPending: boolean;
  inPuits: boolean;
  inPrison: boolean;
  nextRollAllowedDay: string;
  rollsRemainingToday: number;
  totalRolls: number;
  wrongAnswers: number;
  hintsUsed: number;
  overshootCount: number;
  finishedAt?: string;
  finishRank?: number;
  updatedAt: string;
}
