import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getTeamById, getAllTeamProgress, getEnigmaById } from '../../../utils/dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin get team progress endpoint
 * Returns detailed progress for all enigmas for a specific team
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    const teamId = event.pathParameters?.teamId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    if (!teamId) {
      return error('Team ID is required', 400);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Verify team exists
    const team = await getTeamById(teamId);

    if (!team) {
      return error('Team not found', 404);
    }

    // Get all team progress
    const progressResult = await getAllTeamProgress(teamId);

    // Enhance progress with enigma details
    const enhancedProgress = await Promise.all(
      progressResult.map(async (progress: any) => {
        const enigma = await getEnigmaById(progress.enigmaId);
        return {
          ...progress,
          enigmaTitle: enigma?.title || 'Unknown',
          enigmaNumber: enigma?.enigmaNumber || 0,
        };
      })
    );

    // Sort by enigma number
    enhancedProgress.sort((a, b) => a.enigmaNumber - b.enigmaNumber);

    return success({
      progress: enhancedProgress,
    });
  } catch (err: any) {
    console.error('Admin get team progress error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch team progress', 500);
  }
};
