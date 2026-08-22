import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPasswordAttemptsByEnigma } from '../../utils/dynamodb';
import { getTestTeamIds, excludeTestTeamRows } from '../../utils/testTeams';
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

    const enigmaId = event.pathParameters?.enigmaId;
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 100;

    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    const allAttempts = await getPasswordAttemptsByEnigma(enigmaId, limit);

    // Attempts made by a test team must not show up in the enigma diagnosis
    const testTeamIds = await getTestTeamIds();
    const attempts = excludeTestTeamRows(allAttempts, testTeamIds);

    return success({
      enigmaId,
      attempts,
      count: attempts.length,
    });
  } catch (err: any) {
    console.error('Error getting attempts by enigma:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to get attempts by enigma');
  }
};
