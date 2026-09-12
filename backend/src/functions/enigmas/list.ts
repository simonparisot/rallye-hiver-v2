import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllEnigmas } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const enigmas = await getAllEnigmas();

    // Sort by enigmaNumber
    enigmas.sort((a: any, b: any) => a.enigmaNumber - b.enigmaNumber);

    // Ni le mot de passe, ni la demarche de resolution, ni le texte des indices
    // ne sortent d'ici : le joueur n'apprend que le nombre d'indices existants,
    // pour savoir s'il peut en demander un.
    const sanitizedEnigmas = enigmas.map((enigma: any) => {
      const { correctPassword, solution, hints, ...rest } = enigma;
      return {
        ...rest,
        hintsCount: Array.isArray(hints) ? hints.length : 0,
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
