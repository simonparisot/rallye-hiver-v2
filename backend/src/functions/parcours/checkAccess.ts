import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parcoursId = event.pathParameters?.parcoursId;
    const userId = event.requestContext.authorizer?.userId;

    if (!parcoursId) {
      return error('Missing parcoursId parameter', 400);
    }

    if (!userId) {
      return error('Unauthorized', 401);
    }

    // Get user to find team
    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return success({
        hasAccess: false,
        reason: 'User is not in a team',
      });
    }

    // All parcours are now accessible without conditions
    const now = new Date().toISOString();
    return success({
      hasAccess: true,
      unlockedAt: now,
      unlockedBy: [], // No specific enigmas required
    });
  } catch (err: any) {
    console.error('Error checking parcours access:', err);
    return error(err.message || 'Failed to check parcours access');
  }
};
