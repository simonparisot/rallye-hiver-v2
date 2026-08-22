import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllEnigmas } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const enigmas = await getAllEnigmas();

    // Sort by enigmaNumber
    enigmas.sort((a: any, b: any) => a.enigmaNumber - b.enigmaNumber);

    // Don't expose the correct password or hint URL to clients
    // Instead, expose hasHint boolean so frontend knows if hint is available
    const sanitizedEnigmas = enigmas.map((enigma: any) => {
      const { correctPassword, hintPdfUrl, ...rest } = enigma;
      return {
        ...rest,
        hasHint: !!hintPdfUrl, // Boolean indicating if hint is available
      };
    });

    return success({
      enigmas: sanitizedEnigmas,
      count: sanitizedEnigmas.length,
    });
  } catch (err: any) {
    console.error('Error listing enigmas:', err);
    return error(err.message || 'Failed to list enigmas');
  }
};
