import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getAllParcours, getAllTeamParcoursAccess } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { loadAccessContext, evaluateParcoursAccess, withoutPdf } from '../../utils/parcoursAccess';

/**
 * Les tournées publiées, avec pour chacune son état pour l'équipe : ouverte ou
 * non, intrigues requises et résolues, réalisation déclarée.
 *
 * `parcours` les liste toutes ; `accessibleParcours` ne garde que les
 * ouvertes, pour les clients qui ne lisaient que celle-là. Le PDF d'une
 * tournée verrouillée n'est jamais renvoyé.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Unauthorized', 401);
    }

    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('User is not in a team', 403);
    }

    const [allParcours, accessRecords, context] = await Promise.all([
      getAllParcours(),
      getAllTeamParcoursAccess(user.teamId),
      loadAccessContext(user.teamId),
    ]);

    const accessMap = new Map(
      accessRecords.map((record: any) => [record.parcoursId, record])
    );

    const parcours = allParcours
      .map((p: any) => {
        const { isUnlocked, requiredEnigmas } = evaluateParcoursAccess(p, context);
        const accessRecord: any = accessMap.get(p.parcoursId);
        return {
          ...(isUnlocked ? p : withoutPdf(p)),
          isUnlocked,
          requiredEnigmas,
          unlockedAt: isUnlocked ? accessRecord?.unlockedAt || null : null,
          unlockedBy: accessRecord?.unlockedBy || [],
          completed: accessRecord?.completed || false,
          completedAt: accessRecord?.completedAt || null,
        };
      })
      .sort((a: any, b: any) => a.parcoursNumber - b.parcoursNumber);

    const accessibleParcours = parcours.filter((p: any) => p.isUnlocked);

    return success({
      teamId: user.teamId,
      parcours,
      accessibleParcours,
      count: accessibleParcours.length,
    });
  } catch (err: any) {
    console.error('Error getting accessible parcours:', err);
    return error(err.message || 'Failed to get accessible parcours');
  }
};
