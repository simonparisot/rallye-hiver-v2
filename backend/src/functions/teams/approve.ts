import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getTeamById, updateTeam, updateUser } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Approve request event:', JSON.stringify(event, null, 2));

  try {
    const requesterId = event.requestContext?.authorizer?.userId;
    const teamId = event.pathParameters?.teamId;
    const targetUserId = event.pathParameters?.userId;

    console.log('RequesterId:', requesterId);
    console.log('TeamId:', teamId);
    console.log('TargetUserId:', targetUserId);

    if (!teamId || !targetUserId) {
      return errorResponse('Team ID and User ID are required', 400);
    }

    // Get team
    const team = await getTeamById(teamId);

    if (!team) {
      return errorResponse('Team not found', 404);
    }

    console.log('Team members:', team.members);
    console.log('Team leaderId:', team.leaderId);

    // Check if requester is team leader or member
    const isTeamMember = team.members?.includes(requesterId);
    console.log('Is team member:', isTeamMember);

    if (!isTeamMember) {
      return errorResponse('Only team members can approve join requests', 403);
    }

    // Check if target user is in pending requests
    if (!team.pendingRequests?.includes(targetUserId)) {
      return errorResponse('User does not have a pending request for this team', 400);
    }

    // Get target user
    const targetUser = await getUserById(targetUserId);

    if (!targetUser) {
      return errorResponse('Target user not found', 404);
    }

    // Check if target user is already in a team
    if (targetUser.teamId) {
      return errorResponse('User is already in a team', 400);
    }

    // Remove from pending requests and add to members
    const updatedPendingRequests = team.pendingRequests.filter(id => id !== targetUserId);
    const updatedMembers = [...(team.members || []), targetUserId];

    await updateTeam(teamId, {
      pendingRequests: updatedPendingRequests,
      members: updatedMembers,
    });

    // Update target user
    const now = new Date().toISOString();
    await updateUser(targetUserId, {
      teamId,
      role: 'member',
      updatedAt: now,
    });

    return successResponse({
      message: 'User approved',
    });
  } catch (error: any) {
    console.error('Approve request error:', error);
    return errorResponse(error.message || 'Failed to approve request', 500);
  }
};
