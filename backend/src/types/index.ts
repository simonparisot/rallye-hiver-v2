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
  /**
   * Première résolution d'une intrigue préliminaire par l'équipe : le thème
   * officiel lui est débloqué avant le lancement (utils/gamePhase).
   */
  themeUnlockedAt?: string;
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
  /** Indices ouverts aux équipes. Absent = fermés (voir utils/hintAvailability). */
  hintsEnabled?: boolean;
  /** Jour de Paris (AAAA-MM-JJ) à partir duquel les indices s'ouvrent. */
  hintsAvailableFrom?: string | null;
  /**
   * « Presque bons » mots de passe : saisis par une équipe, ils ne résolvent
   * pas l'intrigue mais renvoient le message de l'organisateur au lieu du
   * message de refus tiré au hasard. Comparés comme le vrai mot de passe.
   * Jamais exposés aux joueurs (voir utils/nearMisses).
   */
  nearMisses?: NearMiss[];
  points: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isActive: boolean;
  /**
   * Intrigue préliminaire : jouable seulement avant le lancement officiel,
   * elle débloque le thème officiel pour l'équipe qui la résout. Elle ne
   * compte nulle part (score, statistiques, classement, tournées).
   * Absent = vraie intrigue.
   */
  isPreliminary?: boolean;
  createdAt: string;
  updatedAt: string;
  gameId?: string;
}

export interface NearMiss {
  password: string;
  message: string;
}

export interface Parcours {
  parcoursId: string;
  parcoursNumber: number;
  title: string;
  description?: string;
  pdfUrl: string;
  requiredEnigmaIds: string[];
  requiredEnigmasCount: number;
  /**
   * Mot de passe que l'équipe trouve à la fin de la tournée et saisit pour la
   * valider. Comparé comme celui des intrigues (utils/password). Jamais
   * renvoyé aux joueurs, qui ne voient que `hasPassword`.
   */
  correctPassword?: string;
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
  /** Mauvaise tentative qui correspondait à un « presque bon » de l'intrigue. */
  nearMiss?: boolean;
  attemptedAt: string;
  attemptedBy?: string; // userId
  ipAddress?: string;
}

/** Tentative de mot de passe de fin de tournée (table ParcoursAttempts). */
export interface ParcoursAttemptLog {
  attemptId: string;
  teamId: string;
  parcoursId: string;
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
  completed?: boolean; // Vrai quand l'équipe a saisi le mot de passe de fin de tournée
  completedAt?: string; // Première validation de la tournée
  createdAt: string;
}

// Game Status Interface

export interface GameStatus {
  gameId: string; // Fixed ID: "rallye-2025"
  isStarted: boolean; // Whether the game has been started by admin
  startedAt?: string; // ISO 8601 timestamp when game was started
  startedBy?: string; // Admin userId who started the game
  /** Heure de lancement automatique ; absente = DATE_LANCEMENT_PAR_DEFAUT (utils/gamePhase). */
  launchAt?: string;
  /** Dernier retour en avant-lancement (POST /admin/game/reset). */
  resetAt?: string;
  resetBy?: string;
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
 * Etat d'une demande d'indice.
 *
 * En mode `anthropic`, une demande nait `done` : l'appel au modele a lieu dans
 * la lambda et la reponse est synchrone. En mode `queue`, elle nait `pending`,
 * un worker exterieur la prend (`processing`) puis la conclut.
 */
export type HintRequestStatus = 'pending' | 'processing' | 'done' | 'failed';

/**
 * Une demande d'indice, telle qu'elle est archivee. Une ligne par demande :
 * c'est le journal que l'organisateur relit pour juger de l'essai.
 */
export interface HintRequest {
  requestId: string;
  teamId: string;
  enigmaId: string;
  status: HintRequestStatus;
  requestedAt: string; // ISO 8601
  requestedBy: string; // userId
  progressText: string; // Le texte libre ecrit par l'equipe
  /** Identifiants des indices deja donnes a l'equipe au moment de la demande. */
  excludedHintIds?: string[];
  /** Renseignes une fois la demande conclue avec succes. */
  hintId?: string;
  hintText?: string; // Le texte de l'indice tel qu'il a ete livre
  justification?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Renseigne quand la demande echoue, pour le journal de l'organisateur. */
  failureReason?: string;
  /** Pose au moment ou un worker prend la demande, pour deverrouiller un worker mort. */
  processingStartedAt?: string;
  completedAt?: string;
  pointsCharged: number;
}
