import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getTeamById, updateTeam, updateUser } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Remove member event:', JSON.stringify(event, null, 2));

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

    // Check if requester is team leader
    if (team.leaderId !== requesterId) {
      return errorResponse('Only the team leader can remove members', 403);
    }

    // Cannot remove the leader
    if (targetUserId === team.leaderId) {
      return errorResponse('The team leader cannot be removed', 400);
    }

    // Check if target user is a member
    if (!team.members?.includes(targetUserId)) {
      return errorResponse('User is not a member of this team', 400);
    }

    // Remove from members
    const updatedMembers = team.members.filter(id => id !== targetUserId);

    await updateTeam(teamId, {
      members: updatedMembers,
    });

    // Update user
    const now = new Date().toISOString();
    await updateUser(targetUserId, {
      teamId: null,
      role: null,
      updatedAt: now,
    });

    return successResponse({
      message: 'Member removed',
    });
  } catch (error: any) {
    console.error('Remove member error:', error);
    return errorResponse(error.message || 'Failed to remove member', 500);
  }
};
