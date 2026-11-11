// Admin-specific types extending base types
import { BackendEnigma, BackendParcours, Team, TeamEnigmaProgress, EnigmaHint } from '../../types';

export type { EnigmaHint };

export interface AdminUser {
  userId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface AdminStats {
  totalTeams: number;
  totalPlayers: number;
  totalEnigmas: number;
  totalParcours: number;
  teamsWithPayment: number;
  totalAttempts: number;
  successfulAttempts: number;
}

export interface TeamWithProgress extends Team {
  totalAttempts: number;
  solvedEnigmasCount: number;
  unlockedParcoursCount: number;
  lastActivityAt?: string;
}

export interface AttemptRecord {
  attemptId: string;
  teamId: string;
  teamName: string;
  enigmaId: string;
  enigmaTitle: string;
  password: string;
  success: boolean;
  attemptedAt: string;
  attemptedBy: string;
  attemptedByName: string;
}

export interface EnigmaWithStats extends BackendEnigma {
  totalAttempts: number;
  successfulAttempts: number;
  teamsSolved: number;
}

export interface ParcoursWithStats extends BackendParcours {
  teamsUnlocked: number;
}

export interface CreateEnigmaRequest {
  enigmaNumber: number;
  title: string;
  correctPassword: string;
  pdfUrl: string;  // TODO: Replace with file upload once S3 integration is ready
  solution?: string;      // Demarche de resolution detaillee, fausses pistes comprises
  hints?: EnigmaHint[];   // Indices pre-ecrits, du plus precoce au plus tardif
  hintsEnabled?: boolean;            // Indices ouverts aux équipes
  hintsAvailableFrom?: string | null; // AAAA-MM-JJ ; vide = dès l'ouverture
  isActive: boolean;
}

export interface UpdateEnigmaRequest extends Partial<CreateEnigmaRequest> {
  enigmaId: string;
}

export interface CreateParcoursRequest {
  /** Absent à la création : le serveur place la tournée après la dernière. */
  parcoursNumber?: number;
  title: string;
  pdfUrl: string;
  /** Intrigues à résoudre toutes pour ouvrir la tournée ; vide = tournée libre. */
  requiredEnigmaIds: string[];
  isActive: boolean;
}

export interface UpdateParcoursRequest extends Partial<CreateParcoursRequest> {
  parcoursId: string;
}
