import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error } from '../../utils/response';
import { OieAccessError, requirePlayer } from './context';
import { parisDay } from './rules';
import { getBoard, getTeamState } from './store';
import { buildBoardView } from './view';

/**
 * GET /oie
 *
 * The whole shared board for the calling team: the 64 squares without their
 * questions, the position of every team, my own card (question in wait, quota,
 * what blocks me) and the recent event feed.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const player = await requirePlayer(event);

    const now = new Date();
    const today = parisDay(now);

    const board = await getBoard();
    const state = await getTeamState(player.teamId, today, now.toISOString());

    const view = await buildBoardView(board, state, player.teamId, player.teamName, today);

    return success(view);
  } catch (err: any) {
    if (err instanceof OieAccessError) {
      return error(err.message, err.statusCode);
    }
    console.error('Error loading the oie board:', err);
    return error(err.message || 'Impossible de charger le plateau');
  }
};
