import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getAllParcours, getAllTeamParcoursAccess } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Unauthorized', 401);
    }

    // Get user to find team
    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('User is not in a team', 403);
    }

    // Get ALL parcours - no longer checking access, all parcours are accessible
    const allParcours = await getAllParcours();

    // Get team's parcours access records (to check completion status)
    const accessRecords = await getAllTeamParcoursAccess(user.teamId);
    const accessMap = new Map(
      accessRecords.map((record: any) => [record.parcoursId, record])
    );

    // Filter active parcours and add unlock/completion info
    const now = new Date().toISOString();
    const accessibleParcours = allParcours
      .filter((parcours: any) => parcours.isActive)
      .map((parcours: any) => {
        const accessRecord = accessMap.get(parcours.parcoursId);
        return {
          ...parcours,
          unlockedAt: accessRecord?.unlockedAt || now, // All parcours are unlocked by default
          unlockedBy: accessRecord?.unlockedBy || [], // No specific enigmas required
          completed: accessRecord?.completed || false, // Include completion status
          completedAt: accessRecord?.completedAt || null, // Include completion timestamp
        };
      });

    // Sort by parcours number
    accessibleParcours.sort((a: any, b: any) => a.parcoursNumber - b.parcoursNumber);

    return success({
      teamId: user.teamId,
      accessibleParcours,
      count: accessibleParcours.length,
    });
  } catch (err: any) {
    console.error('Error getting accessible parcours:', err);
    return error(err.message || 'Failed to get accessible parcours');
  }
};
