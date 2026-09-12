import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getEnigmaById } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const enigmaId = event.pathParameters?.enigmaId;

    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    const enigma = await getEnigmaById(enigmaId);

    if (!enigma) {
      return error('Enigma not found', 404);
    }

    // Ni le mot de passe, ni la demarche de resolution, ni le texte des indices
    // ne doivent atteindre un client.
    const { correctPassword, solution, hints, ...rest } = enigma as any;
    const sanitizedEnigma = {
      ...rest,
      hintsCount: Array.isArray(hints) ? hints.length : 0,
    };

    return success({
      enigma: sanitizedEnigma,
    });
  } catch (err: any) {
    console.error('Error getting enigma:', err);
    return error(err.message || 'Failed to get enigma');
  }
};
