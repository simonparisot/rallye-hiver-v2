import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getGameStatus, startGame } from '../../../utils/dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { etatJeuAdmin } from './status';

/**
 * POST /admin/game/start — lance le jeu maintenant, sans attendre l'heure de
 * lancement (utils/gamePhase). On peut revenir en avant-lancement avec
 * POST /admin/game/reset.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const gameStatus: any = await getGameStatus();
    if (gameStatus?.isStarted === true) {
      return error('Game has already been started', 400);
    }

    // Upsert : crée l'item s'il n'existe pas encore.
    const updatedStatus = await startGame(userId);

    return success({
      message: 'Game started successfully',
      gameStatus: updatedStatus,
      ...etatJeuAdmin(updatedStatus),
    });
  } catch (err: any) {
    console.error('Start game error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to start game', 500);
  }
};
