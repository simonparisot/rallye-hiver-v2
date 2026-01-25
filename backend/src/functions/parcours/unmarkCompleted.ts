import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getUserById,
  getParcoursById,
  getTeamParcoursAccess,
  updateTeamParcoursAccess,
  updateTeam,
} from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

/**
 * Unmark a parcours as completed for the team
 * This allows users to reset the completion status
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    const parcoursId = event.pathParameters?.parcoursId;

    if (!userId) {
      return error('Unauthorized', 401);
    }

    if (!parcoursId) {
      return error('Missing parcoursId', 400);
    }

    // Get user and verify team membership
    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('User must be in a team', 403);
    }

    // Verify parcours exists
    const parcours = await getParcoursById(parcoursId);
    if (!parcours) {
      return error('Parcours not found', 404);
    }

    // Check if team has access record
    const accessRecord = await getTeamParcoursAccess(user.teamId, parcoursId);

    if (!accessRecord) {
      return error('No access record found for this parcours', 404);
    }

    const now = new Date().toISOString();

    // Update team lastActivityAt when parcours is unmarked
    await updateTeam(user.teamId, { lastActivityAt: now });

    // Update record to remove completion
    await updateTeamParcoursAccess(user.teamId, parcoursId, {
      completed: false,
      completedAt: undefined, // Remove completedAt timestamp
    });

    return success({
      message: 'Parcours completion status reset',
      parcoursId,
    });
  } catch (err: any) {
    console.error('Error unmarking parcours as completed:', err);
    return error(err.message || 'Failed to unmark parcours as completed');
  }
};
