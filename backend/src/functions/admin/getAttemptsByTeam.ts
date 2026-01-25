import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPasswordAttemptsByTeam } from '../../utils/dynamodb';
import { requireAdmin } from '../../utils/adminAuth';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const teamId = event.pathParameters?.teamId;
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 100;

    if (!teamId) {
      return error('Missing teamId parameter', 400);
    }

    const attempts = await getPasswordAttemptsByTeam(teamId, limit);

    return success({
      teamId,
      attempts,
      count: attempts.length,
    });
  } catch (err: any) {
    console.error('Error getting attempts by team:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to get attempts by team');
  }
};
