export interface User {
  userId: string;
  email: string;
  displayName: string;
  teamId: string | null;
  role: 'leader' | 'member' | null;
}

export interface Team {
  teamId: string;
  teamName: string;
  leaderId: string;
  members: TeamMember[];
  hasPaid: boolean;
  pendingRequests?: TeamMember[];
  points?: number;
  solvedEnigmasCount?: number;
  lastActivityAt?: string;
}

export interface TeamMember {
  userId: string;
  displayName: string;
}

export interface TeamListItem {
  teamId: string;
  teamName: string;
  memberCount: number;
  hasPaid: boolean;
}

export interface EnigmaData {
  title: string;
  description: string;
  enigmas: Enigma[];
}

// ==================== GAME CONTENT (Backend Schema) ====================

export interface BackendEnigma {
  enigmaId: string;
  enigmaNumber: number;
  title: string;
  description?: string;
  pdfUrl: string;
  hintsCount?: number;  // Nombre d'indices existants (le texte reste cote serveur)
  solution?: string;    // Demarche de resolution, cote admin uniquement
  hints?: EnigmaHint[]; // Indices pre-ecrits, cote admin uniquement
  hintsEnabled?: boolean;            // Indices ouverts aux équipes (absent = fermés)
  hintsAvailableFrom?: string | null; // AAAA-MM-JJ, jour de Paris d'ouverture
  points: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackendParcours {
  parcoursId: string;
  parcoursNumber: number;
  title: string;
  description?: string;
  pdfUrl: string;
  requiredEnigmaIds: string[];
  requiredEnigmasCount: number;
  /** Réponses joueurs : la tournée a-t-elle un mot de passe de fin ? */
  hasPassword?: boolean;
  /** Réponses d'administration seulement : jamais envoyé aux joueurs. */
  correctPassword?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamEnigmaProgress {
  teamId: string;
  enigmaId: string;
  solved: boolean;
  solvedAt?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  firstAttemptAt?: string;
  hintsRequested?: number; // Nombre d'indices obtenus sur cette intrigue
  lastHintAt?: string;     // Date du dernier indice obtenu
  createdAt: string;
  updatedAt: string;
}

export interface TeamParcoursAccess {
  teamId: string;
  parcoursId: string;
  hasAccess: boolean;
  unlockedAt: string;
  unlockedBy: string[];
  createdAt: string;
  completed?: boolean;
  completedAt?: string;
}

// ==================== API RESPONSES ====================

export interface EnigmasListResponse {
  enigmas: BackendEnigma[];
  count: number;
}

export interface ParcoursListResponse {
  parcours: BackendParcours[];
  count: number;
}

export interface PasswordAttemptResponse {
  success: boolean;
  message: string;
  /**
   * Vrai quand la saisie est un « presque bon » prévu par l'orga : l'intrigue
   * n'est pas résolue (`success` faux), `message` est le sien.
   */
  nearMiss?: boolean;
  points?: number;
  totalTeamPoints?: number;
  attemptCount?: number;
  newlyUnlockedParcours?: Array<{
    parcoursId: string;
    title: string;
    parcoursNumber: number;
  }>;
  alreadySolved?: boolean;
}

/** Réponse de POST /parcours/{parcoursId}/attempt. */
export interface ParcoursAttemptResponse {
  success: boolean;
  message: string;
  /** Présent sur une bonne réponse : la tournée était déjà validée. */
  alreadyCompleted?: boolean;
}

export interface TeamProgressResponse {
  teamId: string;
  progress: TeamEnigmaProgress[];
  totalSolved: number;
}

export interface RequiredEnigmaStatus {
  enigmaId: string;
  enigmaNumber: number;
  title: string;
  solved: boolean;
}

/** Une tournée vue par une équipe. Le PDF n'y figure que si elle est ouverte. */
export interface TeamParcours extends Omit<BackendParcours, 'pdfUrl'> {
  pdfUrl?: string;
  isUnlocked: boolean;
  requiredEnigmas: RequiredEnigmaStatus[];
  unlockedAt: string | null;
  unlockedBy: string[];
  completed: boolean;
  completedAt: string | null;
}

export interface AccessibleParcoursResponse {
  teamId: string;
  /** Toutes les tournées publiées, ouvertes ou non. */
  parcours: TeamParcours[];
  /** Les seules tournées ouvertes. */
  accessibleParcours: TeamParcours[];
  count: number;
}

export interface ParcoursAccessResponse {
  hasAccess: boolean;
  unlockedAt?: string | null;
  unlockedBy?: string[];
  requiredEnigmas?: RequiredEnigmaStatus[];
  reason?: string;
}

// ==================== UI-FRIENDLY TYPES ====================

export interface Enigma {
  id: string;
  title: string;
  order: number;
  isSolved: boolean;
  points: number;
  pdfUrl?: string;
  solvedAt?: string;
  attemptCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  hintsCount?: number;     // Nombre d'indices existants pour cette intrigue
  hintsRequested?: number; // Nombre d'indices deja obtenus par l'equipe
}

export interface Parcours {
  id: string;
  title: string;
  order: number;
  isUnlocked: boolean;
  requiredEnigmas: number;
  solvedEnigmas: number;
  pdfUrl?: string;
  unlockedAt?: string;
  requiredEnigmaIds?: string[];
  /** Intrigues à résoudre pour ouvrir la tournée ; vide si elle est libre. */
  requiredEnigmasDetail?: RequiredEnigma[];
  isCompleted?: boolean;
  completedAt?: string;
  /** Faux tant que l'organisateur n'a pas saisi le mot de passe de fin de tournée. */
  hasPassword?: boolean;
}

export interface RequiredEnigma {
  id: string;
  order: number;
  title: string;
  isSolved: boolean;
}

export interface TeamStats {
  teamName: string;
  memberCount: number;
  enigmasSolved: number;
  totalEnigmas: number;
  parcoursCompleted: number;
  totalParcours: number;
  totalPoints: number;
  hintsRequestedCount?: number; // Indices demandés, sans effet sur le score
  passwordAttemptsCount: number;
  attemptsRanking: number;
  attemptsRankingMessage: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface PendingRequest {
  teamId: string;
  teamName: string;
}

// ==================== PRESQUES BONS ====================

/**
 * « Presque bon » mot de passe d'une intrigue : ne la résout pas, mais renvoie
 * le message de l'orga. Côté admin uniquement, jamais envoyé aux joueurs.
 */
export interface NearMiss {
  password: string;
  message: string;
}

// ==================== INDICES ====================

export interface EnigmaHint {
  id: string;
  order: number;
  text: string;
}

/** Un indice deja obtenu par l'equipe, tel qu'il lui a ete livre. */
export interface ObtainedHint {
  id: string;
  text: string;
  requestedAt: string;
  pointsCharged: number;
}

/** Statut d'une demande, tel que le frontend le voit. */
export type HintRequestStatus = 'pending' | 'done' | 'failed';

/** Suivi d'une demande : le texte n'arrive qu'une fois la demande aboutie. */
export interface HintRequestTracking {
  requestId: string;
  status: HintRequestStatus;
  requestedAt: string;
  pointsCharged: number;
  hint?: { id: string; text: string };
  failureReason?: string;
}

export interface HintsListResponse {
  enigmaId: string;
  hints: ObtainedHint[];
  requests: HintRequestTracking[];
  hintsRequested: number;
  remainingHints: number;
  /**
   * Nombre d'indices écrits pour cette intrigue, quoi que l'équipe ait déjà reçu.
   * Zéro veut dire qu'il n'y en a aucun : le bouton ne s'affiche pas.
   * Facultatif le temps que le serveur déployé porte le champ.
   */
  totalHints?: number;
  /**
   * Vrai si l'équipe peut demander un indice maintenant : l'organisateur ouvre
   * les indices intrigue par intrigue, éventuellement à une date. Facultatif le
   * temps que le serveur déployé porte le champ.
   */
  hintsAvailable?: boolean;
  /** Vrai tant qu'une demande n'est pas conclue : le frontend réinterroge. */
  pendingRequest: boolean;
  nextHintCost: number;
  enigmaPoints: number;
  totalPointsCharged: number;
}

/**
 * Réponse a une demande. Selon le mode du serveur, elle est deja conclue
 * (`done`, avec son indice) ou seulement enregistree (`pending`) : le frontend
 * ne sait pas lequel des deux tourne, il lit le statut.
 */
export interface HintRequestResponse {
  requestId: string;
  status: HintRequestStatus;
  hint?: { id: string; text: string };
  pointsCharged: number;
  hintsRequested: number;
  remainingHints: number;
}
