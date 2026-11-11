import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getParcoursById } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { forPlayers } from '../../utils/parcoursAccess';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parcoursId = event.pathParameters?.parcoursId;
    const userId = event.requestContext.authorizer?.userId;

    if (!parcoursId) {
      return error('Missing parcoursId parameter', 400);
    }

    const parcours = await getParcoursById(parcoursId);

    // Une tournée non publiée n'existe pas pour les joueurs (la liste ne la
    // montre pas non plus) ; l'administration passe par /admin/parcours.
    if (!parcours || !parcours.isActive) {
      return error('Parcours not found', 404);
    }

    // Métadonnées seulement : le PDF passe par /progress/parcours, qui
    // vérifie le déblocage ; le mot de passe n'est jamais donné.
    return success({
      parcours: forPlayers(parcours),
    });
  } catch (err: any) {
    console.error('Error getting parcours:', err);
    return error(err.message || 'Failed to get parcours');
  }
};
