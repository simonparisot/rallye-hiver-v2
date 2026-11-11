import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getParcoursById, getTeamParcoursAccess } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { loadAccessContext, evaluateParcoursAccess } from '../../utils/parcoursAccess';
import { phasePourUtilisateur } from '../../utils/gamePhase';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parcoursId = event.pathParameters?.parcoursId;
    const userId = event.requestContext.authorizer?.userId;

    if (!parcoursId) {
      return error('Missing parcoursId parameter', 400);
    }

    if (!userId) {
      return error('Unauthorized', 401);
    }

    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return success({
        hasAccess: false,
        reason: 'User is not in a team',
      });
    }

    const [parcours, phase] = await Promise.all([
      getParcoursById(parcoursId),
      phasePourUtilisateur(userId),
    ]);
    // Avant le lancement, aucune tournée n'existe (utils/gamePhase).
    if (!parcours || !parcours.isActive || phase !== 'lance') {
      return error('Parcours not found', 404);
    }

    const [context, accessRecord] = await Promise.all([
      loadAccessContext(user.teamId),
      getTeamParcoursAccess(user.teamId, parcoursId),
    ]);
    const { isUnlocked, requiredEnigmas } = evaluateParcoursAccess(parcours, context);

    return success({
      hasAccess: isUnlocked,
      unlockedAt: isUnlocked ? accessRecord?.unlockedAt || null : null,
      unlockedBy: accessRecord?.unlockedBy || [],
      requiredEnigmas,
      ...(isUnlocked ? {} : { reason: 'Required enigmas not solved' }),
    });
  } catch (err: any) {
    console.error('Error checking parcours access:', err);
    return error(err.message || 'Failed to check parcours access');
  }
};
