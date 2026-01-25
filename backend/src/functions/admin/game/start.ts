import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getGameStatus, startGame, initializeGameStatus } from '../../../utils/dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin endpoint to start the Rallye d'Hiver game
 * Only admins can start the game
 * Once started, the game cannot be stopped (isStarted cannot be set back to false)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Check if game status exists, if not, initialize it
    let gameStatus = await getGameStatus();

    if (!gameStatus) {
      // Initialize game status if it doesn't exist
      try {
        gameStatus = await initializeGameStatus();
      } catch (err: any) {
        // If initialization fails due to concurrent creation, fetch again
        if (err.name === 'ConditionalCheckFailedException') {
          gameStatus = await getGameStatus();
        } else {
          throw err;
        }
      }
    }

    // Check if game is already started
    if (gameStatus.isStarted) {
      return error('Game has already been started', 400);
    }

    // Start the game
    const updatedStatus = await startGame(userId);

    return success({
      message: 'Game started successfully',
      gameStatus: updatedStatus,
    });
  } catch (err: any) {
    console.error('Start game error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to start game', 500);
  }
};
