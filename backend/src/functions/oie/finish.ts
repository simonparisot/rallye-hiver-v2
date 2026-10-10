/**
 * Winning the jeu de l'oie.
 *
 * Reaching square 63 is no longer the win: a last question stands there, and
 * only its answer carries the enigma. Two handlers therefore need the same
 * ending, roll.ts when a board has no final question configured and answer.ts
 * when the final answer is right, so it lives here rather than twice.
 */

import {
  createOrUpdateTeamProgress,
  getTeamById,
  getTeamProgress,
  updateTeam,
} from '../../utils/dynamodb';
import { OieTeamState } from '../../types/oie';
import { getAllTeamStates } from './store';

/**
 * Rank of the team about to finish: one more than the teams already arrived.
 * Frozen at that instant, the date being kept so that it can be recomputed.
 */
export function finishRankAmong(states: OieTeamState[], teamId: string): number {
  return states.filter((other) => other.teamId !== teamId && !!other.finishedAt).length + 1;
}

/** Same, reading the states itself when the caller has none at hand. */
export async function nextFinishRank(teamId: string): Promise<number> {
  return finishRankAmong(await getAllTeamStates(), teamId);
}

/**
 * Marks the jeu de l'oie enigma solved for the team, the same way
 * progress/submitAttempt.ts does for an ordinary enigma, so that the existing
 * leaderboard and statistics count it without a special case.
 */
export async function markEnigmaSolved(
  enigmaId: string,
  teamId: string,
  now: string
): Promise<void> {
  const existing = await getTeamProgress(teamId, enigmaId);

  if (existing?.solved) {
    return;
  }

  const updates: any = {
    solved: true,
    solvedAt: now,
    lastAttemptAt: now,
    attemptCount: existing?.attemptCount || 0,
    updatedAt: now,
  };

  if (!existing) {
    updates.firstAttemptAt = now;
    updates.createdAt = now;
  }

  await createOrUpdateTeamProgress(teamId, enigmaId, updates);

  const team = await getTeamById(teamId);
  await updateTeam(teamId, {
    solvedEnigmasCount: (team?.solvedEnigmasCount || 0) + 1,
    lastActivityAt: now,
  });
}
