import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getTeamById, updateTeam } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Join team event:', JSON.stringify(event, null, 2));

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

    // Check if user is already in a team
    if (user.teamId) {
      return errorResponse('You are already in a team', 400);
    }

    // Get team
    const team = await getTeamById(teamId);

    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Check if user already has a pending request
    if (team.pendingRequests?.includes(userId)) {
      return errorResponse('You already have a pending request for this team', 400);
    }

    // Add user to pending requests
    const updatedPendingRequests = [...(team.pendingRequests || []), userId];

    await updateTeam(teamId, {
      pendingRequests: updatedPendingRequests,
    });

    return successResponse({
      message: 'Join request sent',
    });
  } catch (error: any) {
    console.error('Join team error:', error);
    return errorResponse(error.message || 'Failed to join team', 500);
  }
};
