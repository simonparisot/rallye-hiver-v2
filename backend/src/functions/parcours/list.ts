import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllParcours } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { withoutPdf } from '../../utils/parcoursAccess';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parcoursList = await getAllParcours();

    // Sort by parcoursNumber
    parcoursList.sort((a: any, b: any) => a.parcoursNumber - b.parcoursNumber);

    // Liste vue par les joueurs, en équipe ou non : l'adresse du PDF n'y
    // figure pas. /progress/parcours la donne aux seules équipes qui ont
    // débloqué la tournée ; l'administration passe par /admin/parcours.
    return success({
      parcours: parcoursList.map(withoutPdf),
      count: parcoursList.length,
    });
  } catch (err: any) {
    console.error('Error listing parcours:', err);
    return error(err.message || 'Failed to list parcours');
  }
};
