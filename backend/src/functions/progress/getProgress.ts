import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getAllTeamProgress } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Unauthorized', 401);
    }

    // Get user to find team
    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('User is not in a team', 403);
    }

    // Get all progress for the team
    const progress = await getAllTeamProgress(user.teamId);

    return success({
      teamId: user.teamId,
      progress,
      totalSolved: progress.filter((p: any) => p.solved).length,
    });
  } catch (err: any) {
    console.error('Error getting team progress:', err);
    return error(err.message || 'Failed to get team progress');
  }
};
