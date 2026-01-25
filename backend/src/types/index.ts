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
