import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getUserById,
  getParcoursById,
  getTeamParcoursAccess,
  updateTeamParcoursAccess,
  grantParcoursAccess,
  updateTeam,
} from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

/**
 * Mark a parcours as completed for the team
 * This is called by the frontend when a user marks a parcours as done
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

    const now = new Date().toISOString();

    // Update team lastActivityAt when parcours is marked as completed
    await updateTeam(user.teamId, { lastActivityAt: now });

    // Check if team already has access record
    let accessRecord = await getTeamParcoursAccess(user.teamId, parcoursId);

    if (accessRecord) {
      // Update existing record
      await updateTeamParcoursAccess(user.teamId, parcoursId, {
        completed: true,
        completedAt: now,
      });
    } else {
      // Create new access record with completed status
      // (This handles the case where parcours are unlocked by default)
      await grantParcoursAccess({
        teamId: user.teamId,
        parcoursId,
        hasAccess: true,
        unlockedAt: now,
        unlockedBy: [],
        completed: true,
        completedAt: now,
        createdAt: now,
      });
    }

    return success({
      message: 'Parcours marked as completed',
      parcoursId,
      completedAt: now,
    });
  } catch (err: any) {
    console.error('Error marking parcours as completed:', err);
    return error(err.message || 'Failed to mark parcours as completed');
  }
};
