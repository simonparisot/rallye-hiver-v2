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
  hintsRequested?: number; // Nombre d'indices obtenus sur cette enigme
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

export interface TeamProgressResponse {
  teamId: string;
  progress: TeamEnigmaProgress[];
  totalSolved: number;
}

export interface AccessibleParcoursResponse {
  teamId: string;
  accessibleParcours: Array<BackendParcours & {
    unlockedAt: string;
    unlockedBy: string[];
  }>;
  count: number;
}

export interface ParcoursAccessResponse {
  hasAccess: boolean;
  unlockedAt?: string;
  unlockedBy?: string[];
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
  hintsCount?: number;     // Nombre d'indices existants pour cette enigme
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
  isCompleted?: boolean;
  completedAt?: string;
}

export interface RequiredEnigma {
  id: string;
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
  hintsRequestedCount?: number; // Indices demandes, toutes enigmes confondues
  hintsPenalty?: number;        // Points retires par les indices
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

export interface HintsListResponse {
  enigmaId: string;
  hints: ObtainedHint[];
  hintsRequested: number;
  remainingHints: number;
  nextHintCost: number;
  enigmaPoints: number;
  totalPointsCharged: number;
}

export interface HintRequestResponse {
  hint: { id: string; text: string };
  pointsCharged: number;
  hintsRequested: number;
  remainingHints: number;
  nextHintCost: number;
}
