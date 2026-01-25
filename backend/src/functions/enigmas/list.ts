import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllEnigmas } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const enigmas = await getAllEnigmas();

    // Sort by enigmaNumber
    enigmas.sort((a: any, b: any) => a.enigmaNumber - b.enigmaNumber);

    // Don't expose the correct password to clients
    const sanitizedEnigmas = enigmas.map((enigma: any) => {
      const { correctPassword, ...rest } = enigma;
      return rest;
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
