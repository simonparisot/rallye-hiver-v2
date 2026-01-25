import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getTeamById } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Check access event:', JSON.stringify(event, null, 2));

  try {
    const userId = event.requestContext?.authorizer?.userId;

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    // Get user
    const user = await getUserById(userId);
    console.log('User:', user);

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Check if user has a team
    if (!user.teamId) {
      console.log('User has no team');
      return successResponse({
        hasAccess: false,
        reason: 'You must be part of a team to access content',
      });
    }

    console.log('User teamId:', user.teamId);

    // Get team
    const team = await getTeamById(user.teamId);
    console.log('Team:', team);

    if (!team) {
      console.log('Team not found');
      return successResponse({
        hasAccess: false,
        reason: 'Team not found',
      });
    }

    // Check if team has paid
    console.log('Team hasPaid:', team.hasPaid);
    if (!team.hasPaid) {
      console.log('Team has not paid');
      return successResponse({
        hasAccess: false,
        reason: 'Your team must complete payment to access content',
      });
    }

    console.log('Access granted');
    return successResponse({
      hasAccess: true,
    });
  } catch (error: any) {
    console.error('Check access error:', error);
    return errorResponse(error.message || 'Failed to check access', 500);
  }
};
