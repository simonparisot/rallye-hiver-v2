import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllEnigmas } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { phasePourUtilisateur, intrigueOuverte, estPreliminaire } from '../../utils/gamePhase';

/**
 * GET /enigmas — les intrigues publiées ouvertes dans la phase de l'appelant :
 * les préliminaires avant le lancement, les vraies intrigues après
 * (utils/gamePhase).
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const [enigmas, phase] = await Promise.all([
      getAllEnigmas(),
      phasePourUtilisateur(event.requestContext?.authorizer?.userId),
    ]);

    // Sort by enigmaNumber
    enigmas.sort((a: any, b: any) => a.enigmaNumber - b.enigmaNumber);

    // Seules les intrigues publiees sortent d'ici. Ni le mot de passe, ni la
    // demarche de resolution, ni le texte des indices, ni la date d'ouverture
    // des indices (que l'orga n'a pas a annoncer) : le joueur n'apprend que le
    // nombre d'indices existants, pour savoir s'il peut en demander un. Les
    // « presques bons » mots de passe restent aussi cote serveur. Une
    // préliminaire n'a pas d'indice à demander : son compteur est nul.
    const sanitizedEnigmas = enigmas
      .filter((enigma: any) => enigma.isActive !== false && intrigueOuverte(enigma, phase))
      .map((enigma: any) => {
        const { correctPassword, solution, hints, hintsAvailableFrom, nearMisses, ...rest } = enigma;
        return {
          ...rest,
          hintsCount: !estPreliminaire(enigma) && Array.isArray(hints) ? hints.length : 0,
        };
      });

    return success({
      enigmas: sanitizedEnigmas,
      count: sanitizedEnigmas.length,
      phase,
    });
  } catch (err: any) {
    console.error('Error listing enigmas:', err);
    return error(err.message || 'Failed to list enigmas');
  }
};
