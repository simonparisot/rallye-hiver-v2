import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { initialTeamState, parisDay, rollsRemaining, teamStatus } from '../rules';
import { getAllTeamStates, getBoard, getTeamState, logEvent, putTeamState } from '../store';
import { getTeamNames } from '../view';

/**
 * GET /admin/oie/teams
 *
 * Every team that has opened the board, with enough detail to understand where
 * it is stuck and how much it has played.
 */
export const listHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return error('Authentication required', 401);
    await requireAdmin(userId);

    const today = parisDay(new Date());
    const [board, states, names] = await Promise.all([getBoard(), getAllTeamStates(), getTeamNames()]);

    const teams = states
      .map((state) => ({
        teamId: state.teamId,
        teamName: names.get(state.teamId)?.teamName || 'Équipe inconnue',
        isTestTeam: names.get(state.teamId)?.isTest || false,
        position: state.position,
        status: teamStatus(state, today, board.rollsPerDay),
        questionPending: state.questionPending,
        inPuits: state.inPuits,
        inPrison: state.inPrison,
        nextRollAllowedDay: state.nextRollAllowedDay,
        rollsRemainingToday: rollsRemaining(state, today, board.rollsPerDay),
        totalRolls: state.totalRolls,
        wrongAnswers: state.wrongAnswers,
        hintsUsed: (state.hintedSquares || []).length,
        overshootCount: state.overshootCount,
        finishedAt: state.finishedAt,
        finishRank: state.finishRank,
        updatedAt: state.updatedAt,
      }))
      .sort((a, b) => b.position - a.position);

    return success({ teams, count: teams.length, rollsPerDay: board.rollsPerDay, today });
  } catch (err: any) {
    console.error('Error listing the oie team states:', err);
    return error(err.message || 'Impossible de charger les équipes', err.message === 'Admin access required' ? 403 : 500);
  }
};

/**
 * POST /admin/oie/teams/{teamId}/reset
 *
 * Puts a team back on square 0, for a test or after an incident. The journal
 * keeps the trace: nothing disappears, the team simply starts again.
 */
export const resetHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return error('Authentication required', 401);
    await requireAdmin(userId);

    const teamId = event.pathParameters?.teamId;
    if (!teamId) return error('Missing teamId parameter', 400);

    const now = new Date();
    const nowIso = now.toISOString();
    const today = parisDay(now);

    const current = await getTeamState(teamId, today, nowIso);
    const fresh = initialTeamState(teamId, today, nowIso);

    await putTeamState({ ...fresh, createdAt: current.createdAt, version: current.version }, current.version);

    const names = await getTeamNames();
    const teamName = names.get(teamId)?.teamName || 'Équipe inconnue';

    await logEvent({
      type: 'reinitialisation',
      teamId,
      teamName,
      userId,
      occurredAt: nowIso,
      message: `${teamName} est remis en case 0 par l'organisation`,
      detail: { previousPosition: current.position },
    });

    return success({ teamId, teamName, message: 'Équipe remise à zéro' });
  } catch (err: any) {
    console.error('Error resetting an oie team state:', err);
    return error(err.message || 'Impossible de remettre l\'équipe à zéro', err.message === 'Admin access required' ? 403 : 500);
  }
};
