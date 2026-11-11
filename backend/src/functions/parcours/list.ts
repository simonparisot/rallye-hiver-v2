import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllParcours } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { forPlayers } from '../../utils/parcoursAccess';
import { phasePourUtilisateur } from '../../utils/gamePhase';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Avant le lancement, aucune tournée n'existe pour les joueurs
    // (utils/gamePhase) : pas même leurs titres.
    const phase = await phasePourUtilisateur(event.requestContext?.authorizer?.userId);
    if (phase !== 'lance') {
      return success({ parcours: [], count: 0, phase });
    }

    const parcoursList = await getAllParcours();

    // Sort by parcoursNumber
    parcoursList.sort((a: any, b: any) => a.parcoursNumber - b.parcoursNumber);

    // Liste vue par les joueurs, en équipe ou non : ni l'adresse du PDF ni
    // le mot de passe de fin de tournée n'y figurent. /progress/parcours la donne aux seules équipes qui ont
    // débloqué la tournée ; l'administration passe par /admin/parcours.
    return success({
      parcours: parcoursList.map((p: any) => forPlayers(p)),
      count: parcoursList.length,
    });
  } catch (err: any) {
    console.error('Error listing parcours:', err);
    return error(err.message || 'Failed to list parcours');
  }
};
