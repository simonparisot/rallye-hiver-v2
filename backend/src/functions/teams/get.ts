import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getTeamById, getUsersByIds } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get team event:', JSON.stringify(event, null, 2));

  try {
    const userId = event.requestContext?.authorizer?.userId;
    const teamId = event.pathParameters?.teamId;

    if (!teamId) {
      return errorResponse('Team ID is required', 400);
    }

    const team = await getTeamById(teamId);

    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Get member details
    const members = await getUsersByIds(team.members || []);
    const memberDetails = members.map(m => ({
      userId: m.userId,
      displayName: m.displayName,
    }));

    // Check if user is part of the team (leader or member)
    const isTeamMember = team.members?.includes(userId);

    console.log('Team members:', team.members);
    console.log('Current userId:', userId);
    console.log('Is team member:', isTeamMember);
    console.log('Pending requests in team:', team.pendingRequests);

    const response: any = {
      teamId: team.teamId,
      teamName: team.teamName,
      leaderId: team.leaderId,
      members: memberDetails,
      hasPaid: team.hasPaid,
    };

    // Only show pending requests if user is a team member or leader
    if (isTeamMember) {
      const pendingUsers = await getUsersByIds(team.pendingRequests || []);
      console.log('Pending users fetched:', pendingUsers);
      response.pendingRequests = pendingUsers.map(u => ({
        userId: u.userId,
        displayName: u.displayName,
      }));
    }

    console.log('Final response:', JSON.stringify(response));
    return successResponse(response);
  } catch (error: any) {
    console.error('Get team error:', error);
    return errorResponse(error.message || 'Failed to get team', 500);
  }
};
