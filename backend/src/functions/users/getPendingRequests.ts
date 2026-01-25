import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getTeamsWithPendingRequest } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get pending requests event:', JSON.stringify(event, null, 2));

  try {
    const userId = event.requestContext?.authorizer?.userId;

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    console.log('Getting pending requests for userId:', userId);

    // Get teams where user has pending requests
    const teams = await getTeamsWithPendingRequest(userId);

    console.log('Found teams with pending requests:', teams);

    const pendingRequests = teams.map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
    }));

    return successResponse({
      pendingRequests,
    });
  } catch (error: any) {
    console.error('Get pending requests error:', error);
    return errorResponse(error.message || 'Failed to get pending requests', 500);
  }
};
