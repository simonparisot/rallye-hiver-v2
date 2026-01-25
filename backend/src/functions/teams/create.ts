import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getUserById, createTeam, updateUser, getTeamByName } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create team event:', JSON.stringify(event, null, 2));

  try {
    // For REST API, authorizer context is directly under authorizer, not under lambda
    const userId = event.requestContext?.authorizer?.userId;

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const body = JSON.parse(event.body || '{}');
    const { teamName } = body;

    // Validate input
    if (!teamName || teamName.trim().length === 0) {
      return errorResponse('Team name is required', 400);
    }

    const trimmedTeamName = teamName.trim();

    // Check if team name already exists
    const existingTeam = await getTeamByName(trimmedTeamName);
    if (existingTeam) {
      return errorResponse('A team with this name already exists', 409);
    }

    // Get user
    const user = await getUserById(userId);

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Check if user is already in a team
    if (user.teamId) {
      return errorResponse('You are already in a team', 400);
    }

    // Create team
    const teamId = uuidv4();
    const now = new Date().toISOString();

    const team = await createTeam({
      teamId,
      teamName: trimmedTeamName,
      leaderId: userId,
      hasPaid: false,
      stripePaymentId: null,
      members: [userId],
      pendingRequests: [],
      createdAt: now,
      paidAt: null,
      points: 0,
      solvedEnigmasCount: 0,
    });

    // Update user
    await updateUser(userId, {
      teamId,
      role: 'leader',
      updatedAt: now,
    });

    return successResponse({
      teamId: team.teamId,
      teamName: team.teamName,
      leaderId: team.leaderId,
      members: [userId],
    }, 201);
  } catch (error: any) {
    console.error('Create team error:', error);
    return errorResponse(error.message || 'Failed to create team', 500);
  }
};
