export interface User {
  userId: string;
  cognitoSub: string;
  email: string;
  displayName: string;
  teamId: string | null;
  role: 'leader' | 'member' | null;
  isAdmin?: boolean; // Admin flag for administrative access
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  teamId: string;
  teamName: string;
  leaderId: string;
  hasPaid: boolean;
  stripePaymentId: string | null;
  members: string[]; // Array of userIds
  pendingRequests: string[]; // Array of userIds
  createdAt: string;
  paidAt: string | null;
  // New fields for game progress
  points?: number;
  solvedEnigmasCount?: number;
  lastActivityAt?: string;
  isBetaTeam?: boolean; // Beta team flag for early access before game starts
  isTestTeam?: boolean; // Test team flag: excluded from every list and every statistic
}

export interface AuthUser {
  userId: string;
  cognitoSub: string;
  email: string;
  displayName: string;
}

export interface APIGatewayAuthorizerResult {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: {
      Action: string;
      Effect: string;
      Resource: string;
    }[];
  };
  context?: {
    cognitoSub: string;
    userId: string;
    email: string;
  };
}

// Game Content Interfaces

export interface Enigma {
  enigmaId: string;
  enigmaNumber: number;
  title: string;
  description?: string;
  pdfUrl: string;
  correctPassword: string;
  /**
   * Demarche de resolution complete, redigee par l'organisateur : le chemin
   * attendu, les etapes intermediaires et les fausses pistes. Jamais exposee
   * aux joueurs ; elle ne sert qu'au choix d'indice cote serveur.
   */
  solution?: string;
  /** Indices pre-ecrits, du plus precoce au plus tardif (ordre croissant). */
  hints?: EnigmaHint[];
  points: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  gameId?: string;
}

export interface Parcours {
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
  gameId?: string;
}

// Progress Tracking Interfaces

export interface TeamEnigmaProgress {
  teamId: string;
  enigmaId: string;
  solved: boolean;
  solvedAt?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  firstAttemptAt?: string;
  hintsRequested?: number; // How many hints the team has obtained for this enigma
  lastHintAt?: string; // ISO 8601 timestamp of the latest hint obtained
  createdAt: string;
  updatedAt: string;
}

export interface PasswordAttemptLog {
  attemptId: string;
  teamId: string;
  enigmaId: string;
  teamEnigmaKey: string; // composite: "teamId#enigmaId"
  password: string;
  success: boolean;
  attemptedAt: string;
  attemptedBy?: string; // userId
  ipAddress?: string;
}

export interface TeamParcoursAccess {
  teamId: string;
  parcoursId: string;
  hasAccess: boolean;
  unlockedAt: string;
  unlockedBy: string[]; // Array of enigmaIds that triggered unlock
  completed?: boolean; // Set by frontend when user marks parcours as completed
  completedAt?: string; // Timestamp when parcours was marked as completed
  createdAt: string;
}

// Game Status Interface

export interface GameStatus {
  gameId: string; // Fixed ID: "rallye-2025"
  isStarted: boolean; // Whether the game has been started by admin
  startedAt?: string; // ISO 8601 timestamp when game was started
  startedBy?: string; // Admin userId who started the game
  createdAt: string;
  updatedAt: string;
}

// Hint Interfaces

export interface EnigmaHint {
  id: string;
  order: number;
  text: string;
}

/**
 * Une demande d'indice, telle qu'elle est archivee. Une ligne par demande :
 * c'est le journal que l'organisateur relit pour juger de l'essai.
 */
export interface HintRequest {
  requestId: string;
  teamId: string;
  enigmaId: string;
  requestedAt: string; // ISO 8601
  requestedBy: string; // userId
  progressText: string; // Le texte libre ecrit par l'equipe
  hintId: string;
  hintText: string; // Le texte de l'indice tel qu'il a ete livre
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  pointsCharged: number;
}
