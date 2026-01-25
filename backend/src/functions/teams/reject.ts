import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getTeamById, updateTeam } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Reject request event:', JSON.stringify(event, null, 2));

  try {
    const requesterId = event.requestContext?.authorizer?.userId;
    const teamId = event.pathParameters?.teamId;
    const targetUserId = event.pathParameters?.userId;

    if (!teamId || !targetUserId) {
      return errorResponse('Team ID and User ID are required', 400);
    }

    // Get team
    const team = await getTeamById(teamId);

    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Check if requester is team leader or member
    const isTeamMember = team.members?.includes(requesterId);

    if (!isTeamMember) {
      return errorResponse('Only team members can reject join requests', 403);
    }

    // Check if target user is in pending requests
    if (!team.pendingRequests?.includes(targetUserId)) {
      return errorResponse('User does not have a pending request for this team', 400);
    }

    // Remove from pending requests
    const updatedPendingRequests = team.pendingRequests.filter(id => id !== targetUserId);

    await updateTeam(teamId, {
      pendingRequests: updatedPendingRequests,
    });

    return successResponse({
      message: 'User rejected',
    });
  } catch (error: any) {
    console.error('Reject request error:', error);
    return errorResponse(error.message || 'Failed to reject request', 500);
  }
};
