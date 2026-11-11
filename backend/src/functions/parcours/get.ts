import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getParcoursById } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { withoutPdf } from '../../utils/parcoursAccess';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parcoursId = event.pathParameters?.parcoursId;
    const userId = event.requestContext.authorizer?.userId;

    if (!parcoursId) {
      return error('Missing parcoursId parameter', 400);
    }

    const parcours = await getParcoursById(parcoursId);

    if (!parcours) {
      return error('Parcours not found', 404);
    }

    // Métadonnées seulement : le PDF passe par /progress/parcours, qui
    // vérifie le déblocage.
    return success({
      parcours: withoutPdf(parcours),
    });
  } catch (err: any) {
    console.error('Error getting parcours:', err);
    return error(err.message || 'Failed to get parcours');
  }
};
