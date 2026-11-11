import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getParcoursById } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { forPlayers } from '../../utils/parcoursAccess';
import { phasePourUtilisateur } from '../../utils/gamePhase';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parcoursId = event.pathParameters?.parcoursId;
    const userId = event.requestContext.authorizer?.userId;

    if (!parcoursId) {
      return error('Missing parcoursId parameter', 400);
    }

    const [parcours, phase] = await Promise.all([
      getParcoursById(parcoursId),
      phasePourUtilisateur(userId),
    ]);

    // Une tournée non publiée n'existe pas pour les joueurs (la liste ne la
    // montre pas non plus) ; l'administration passe par /admin/parcours.
    // Avant le lancement, aucune n'existe (utils/gamePhase).
    if (!parcours || !parcours.isActive || phase !== 'lance') {
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
