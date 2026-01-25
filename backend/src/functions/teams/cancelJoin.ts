import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getTeamById, updateTeam } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Cancel join request event:', JSON.stringify(event, null, 2));

  try {
    const userId = event.requestContext?.authorizer?.userId;
    const teamId = event.pathParameters?.teamId;

    console.log('Extracted userId:', userId, 'type:', typeof userId);
    console.log('Extracted teamId:', teamId, 'type:', typeof teamId);

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    if (!teamId) {
      return errorResponse('Team ID is required', 400);
    }

    console.log('About to call getUserById with:', userId);
    // Get user
    const user = await getUserById(userId);
    console.log('Got user:', user ? 'found' : 'not found');

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // User should not be in a team to cancel a request
    if (user.teamId) {
      return errorResponse('You are already in a team', 400);
    }

    // Get team
    const team = await getTeamById(teamId);

    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Check if user has a pending request
    if (!team.pendingRequests?.includes(userId)) {
      return errorResponse('You do not have a pending request for this team', 400);
    }

    // Remove user from pending requests
    const updatedPendingRequests = team.pendingRequests.filter((id: string) => id !== userId);

    await updateTeam(teamId, {
      pendingRequests: updatedPendingRequests,
    });

    return successResponse({
      message: 'Join request cancelled',
    });
  } catch (error: any) {
    console.error('Cancel join request error:', error);
    return errorResponse(error.message || 'Failed to cancel join request', 500);
  }
};
