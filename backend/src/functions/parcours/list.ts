import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllParcours } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parcoursList = await getAllParcours();

    // Sort by parcoursNumber
    parcoursList.sort((a: any, b: any) => a.parcoursNumber - b.parcoursNumber);

    return success({
      parcours: parcoursList,
      count: parcoursList.length,
    });
  } catch (err: any) {
    console.error('Error listing parcours:', err);
    return error(err.message || 'Failed to list parcours');
  }
};
