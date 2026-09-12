import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getEnigmaById,
  getUserById,
  getTeamById,
  getHintRequestsByTeamAndEnigma,
} from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { nextHintCost } from '../../utils/hintCost';
import { ordonnerIndices } from './requestHint';

/**
 * Indices deja obtenus par l'equipe sur une enigme, pour qu'elle puisse les
 * relire, et cout du prochain.
 *
 * GET /hints/{enigmaId}
 *
 * N'expose que les indices deja payes : les indices non encore obtenus ne
 * sortent jamais du backend.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) {
      return error('Unauthorized', 401);
    }

    const enigmaId = event.pathParameters?.enigmaId;
    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('Vous devez appartenir a une equipe pour consulter vos indices', 403);
    }

    const team = await getTeamById(user.teamId);
    if (!team) {
      return error('Team not found', 404);
    }
    if (!team.hasPaid) {
      return error("Votre equipe doit avoir regle son inscription pour acceder aux indices", 403);
    }

    const enigma = await getEnigmaById(enigmaId);
    if (!enigma) {
      return error('Enigma not found', 404);
    }

    const tousLesIndices = ordonnerIndices(enigma.hints);
    const demandes = await getHintRequestsByTeamAndEnigma(user.teamId, enigmaId);

    const obtenus = demandes.map((d: any) => ({
      id: d.hintId,
      text: d.hintText,
      requestedAt: d.requestedAt,
      pointsCharged: d.pointsCharged || 0,
    }));

    const idsObtenus = new Set(obtenus.map((h) => h.id));
    const restants = tousLesIndices.filter((h) => !idsObtenus.has(h.id)).length;

    return success({
      enigmaId,
      hints: obtenus,
      hintsRequested: obtenus.length,
      remainingHints: restants,
      // Cout annonce a l'equipe avant qu'elle confirme sa prochaine demande.
      nextHintCost: restants > 0 ? nextHintCost(enigma.points || 0, obtenus.length) : 0,
      enigmaPoints: enigma.points || 0,
      totalPointsCharged: obtenus.reduce((somme, h) => somme + (h.pointsCharged || 0), 0),
    });
  } catch (err: any) {
    console.error('Error listing hints:', err);
    return error(err.message || 'Failed to list hints');
  }
};
