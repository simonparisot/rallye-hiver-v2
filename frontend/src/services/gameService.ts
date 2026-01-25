import { enigmaAPI, parcoursAPI, progressAPI, teamAPI } from './api';
import { Enigma, Parcours, TeamStats, BackendEnigma, BackendParcours, TeamEnigmaProgress } from '../types';

/**
 * Game Service
 * Provides higher-level functions that combine multiple API calls
 * and transform backend data into UI-friendly formats
 */

/**
 * Transform backend enigma + progress into UI-friendly format
 */
function transformEnigmaWithProgress(
  enigma: BackendEnigma,
  progress?: TeamEnigmaProgress
): Enigma {
  return {
    id: enigma.enigmaId,
    title: enigma.title,
    order: enigma.enigmaNumber,
    isSolved: progress?.solved || false,
    points: enigma.points,
    pdfUrl: enigma.pdfUrl,
    solvedAt: progress?.solvedAt,
    attemptCount: progress?.attemptCount || 0,
    difficulty: enigma.difficulty,
  };
}

/**
 * Transform backend parcours + access into UI-friendly format
 */
function transformParcoursWithAccess(
  parcours: BackendParcours,
  accessInfo: { hasAccess: boolean; unlockedAt?: string; unlockedBy?: string[]; completed?: boolean; completedAt?: string },
  solvedEnigmasCount: number
): Parcours {
  return {
    id: parcours.parcoursId,
    title: parcours.title,
    order: parcours.parcoursNumber,
    isUnlocked: accessInfo.hasAccess,
    requiredEnigmas: parcours.requiredEnigmasCount,
    solvedEnigmas: solvedEnigmasCount,
    pdfUrl: accessInfo.hasAccess ? parcours.pdfUrl : undefined,
    unlockedAt: accessInfo.unlockedAt,
    requiredEnigmaIds: parcours.requiredEnigmaIds,
    isCompleted: accessInfo.completed || false,
    completedAt: accessInfo.completedAt,
  };
}

/**
 * Get all enigmas (preview mode without progress)
 */
export async function getEnigmasPreview(): Promise<Enigma[]> {
  const enigmasResponse = await enigmaAPI.listEnigmas();

  return enigmasResponse.enigmas
    .filter(e => e.isActive)
    .map(enigma => transformEnigmaWithProgress(enigma, undefined))
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all enigmas with user's team progress
 */
export async function getEnigmasWithProgress(): Promise<Enigma[]> {
  const [enigmasResponse, progressResponse] = await Promise.all([
    enigmaAPI.listEnigmas(),
    progressAPI.getTeamProgress(),
  ]);

  const progressMap = new Map(
    progressResponse.progress.map(p => [p.enigmaId, p])
  );

  return enigmasResponse.enigmas
    .filter(e => e.isActive)
    .map(enigma => transformEnigmaWithProgress(enigma, progressMap.get(enigma.enigmaId)))
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all parcours (preview mode without access)
 */
export async function getParcoursPreview(): Promise<Parcours[]> {
  const parcoursResponse = await parcoursAPI.listParcours();

  return parcoursResponse.parcours
    .filter(p => p.isActive)
    .map(parcours => transformParcoursWithAccess(parcours, { hasAccess: false }, 0))
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all parcours with access status and progress
 */
export async function getParcoursWithAccess(): Promise<Parcours[]> {
  const [parcoursResponse, accessibleResponse, progressResponse] = await Promise.all([
    parcoursAPI.listParcours(),
    progressAPI.getAccessibleParcours(),
    progressAPI.getTeamProgress(),
  ]);

  const accessibleMap = new Map(
    accessibleResponse.accessibleParcours.map((p: any) => [
      p.parcoursId,
      {
        hasAccess: true,
        unlockedAt: p.unlockedAt,
        unlockedBy: p.unlockedBy,
        completed: p.completed,
        completedAt: p.completedAt
      }
    ])
  );

  const solvedEnigmasSet = new Set(
    progressResponse.progress.filter(p => p.solved).map(p => p.enigmaId)
  );

  return parcoursResponse.parcours
    .filter(p => p.isActive)
    .map(parcours => {
      const accessInfo = accessibleMap.get(parcours.parcoursId) || { hasAccess: false };
      const solvedCount = parcours.requiredEnigmaIds.filter(id => solvedEnigmasSet.has(id)).length;
      return transformParcoursWithAccess(parcours, accessInfo, solvedCount);
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Get team statistics for the stats panel
 */
export async function getTeamStats(userId: string, teamId: string): Promise<TeamStats> {
  const stats = await teamAPI.getStats();
  return stats;
}

/**
 * Submit a password attempt for an enigma
 */
export async function submitPasswordAttempt(
  enigmaId: string,
  password: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const response = await progressAPI.attemptPassword(enigmaId, password);
    return {
      success: response.success,
      message: response.message,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'An error occurred. Please try again.',
    };
  }
}
