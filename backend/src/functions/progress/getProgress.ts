import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getAllTeamProgress, getAllEnigmasForAdmin } from '../../utils/dynamodb';
import { idsPreliminaires } from '../../utils/gamePhase';
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

    // Get all progress for the team
    const [progress, enigmas] = await Promise.all([
      getAllTeamProgress(user.teamId),
      getAllEnigmasForAdmin(),
    ]);
    // La progression sur les préliminaires est rendue (l'interface s'en sert
    // pour marquer « Résolue »), mais elle ne compte pas (utils/gamePhase).
    const preliminaires = idsPreliminaires(enigmas);

    return success({
      teamId: user.teamId,
      progress,
      totalSolved: progress.filter((p: any) => p.solved && !preliminaires.has(p.enigmaId)).length,
    });
  } catch (err: any) {
    console.error('Error getting team progress:', err);
    return error(err.message || 'Failed to get team progress');
  }
};
