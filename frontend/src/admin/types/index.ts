// Admin-specific types extending base types
import { BackendEnigma, BackendParcours, Team, TeamEnigmaProgress } from '../../types';

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
  hintPdfUrl?: string;  // Optional hint PDF URL
  isActive: boolean;
}

export interface UpdateEnigmaRequest extends Partial<CreateEnigmaRequest> {
  enigmaId: string;
}

export interface CreateParcoursRequest {
  parcoursNumber: number;
  title: string;
  pdfUrl: string;
  isActive: boolean;
}

export interface UpdateParcoursRequest extends Partial<CreateParcoursRequest> {
  parcoursId: string;
}
