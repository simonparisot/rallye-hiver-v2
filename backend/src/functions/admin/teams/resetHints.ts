import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  dynamoDb,
  HINT_REQUESTS_TABLE,
  getAllTeamProgress,
  getTeamById,
} from '../../../utils/dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Rend ses indices à une équipe.
 *
 * Efface les demandes archivées et les compteurs portés par les progressions :
 * l'équipe retrouve son vivier entier, comme si elle n'avait jamais demandé.
 * Sert à rejouer un parcours de test sans recréer l'équipe.
 *
 * Ce qui n'est pas touché, et volontairement : les tentatives de réponse, les
 * énigmes résolues, les points. Les indices et les réponses sont deux
 * histoires distinctes, et seule celle des indices est effacée ici — remettre
 * l'avancement à zéro est un autre geste, qui n'a pas à se cacher derrière
 * celui-ci.
 *
 * Une demande en cours est effacée comme les autres. Le pire qui puisse
 * arriver est qu'un indice déjà payé par un appel au modèle revienne en
 * réserve, ce qui est le but.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return error('Authentication required', 401);
    await requireAdmin(userId);

    const teamId = event.pathParameters?.teamId;
    if (!teamId) return error('Missing teamId parameter', 400);

    const team = await getTeamById(teamId);
    if (!team) return error('Team not found', 404);

    // Les demandes se lisent par énigme : on part donc des progressions, qui
    // sont le seul endroit listant les énigmes que l'équipe a touchées. Une
    // demande sans progression ne peut pas exister — la progression est créée
    // avant elle.
    const progressions = await getAllTeamProgress(teamId);

    let demandesSupprimees = 0;
    for (const p of progressions) {
      const demandes = await dynamoDb.send(new QueryCommand({
        TableName: HINT_REQUESTS_TABLE,
        IndexName: 'teamEnigmaKey-requestedAt-index',
        KeyConditionExpression: 'teamEnigmaKey = :cle',
        ExpressionAttributeValues: { ':cle': `${teamId}#${p.enigmaId}` },
      }));
      for (const d of demandes.Items ?? []) {
        await dynamoDb.send(new DeleteCommand({
          TableName: HINT_REQUESTS_TABLE,
          Key: { requestId: d.requestId },
        }));
        demandesSupprimees += 1;
      }
    }

    // hintUsed et hintUsedAt sont les noms d'avant la refonte des indices ;
    // d'anciennes lignes les portent encore, et les laisser ferait réapparaître
    // un indice consommé.
    const champs = ['hintsRequested', 'lastHintAt', 'hintUsed', 'hintUsedAt'];
    const maintenant = new Date().toISOString();
    let progressionsNettoyees = 0;
    for (const p of progressions) {
      const aRetirer = champs.filter((c) => c in p);
      if (!aRetirer.length) continue;
      await dynamoDb.send(new UpdateCommand({
        TableName: process.env.TEAM_ENIGMA_PROGRESS_TABLE || '',
        Key: { teamId, enigmaId: p.enigmaId },
        UpdateExpression: `REMOVE ${aRetirer.join(', ')} SET updatedAt = :t`,
        ExpressionAttributeValues: { ':t': maintenant },
      }));
      progressionsNettoyees += 1;
    }

    console.log(
      `Indices remis à zéro pour ${team.teamName} (${teamId}) par ${userId} : ` +
      `${demandesSupprimees} demande(s), ${progressionsNettoyees} progression(s).`
    );

    return success({
      teamId,
      teamName: team.teamName,
      hintRequestsDeleted: demandesSupprimees,
      progressRowsCleared: progressionsNettoyees,
      message: demandesSupprimees
        ? `${demandesSupprimees} indice${demandesSupprimees > 1 ? 's' : ''} rendu${demandesSupprimees > 1 ? 's' : ''} à ${team.teamName}.`
        : `${team.teamName} n'avait aucun indice à rendre.`,
    });
  } catch (err: any) {
    console.error('Error resetting team hints:', err);
    return error(
      err.message || 'Impossible de réinitialiser les indices',
      err.message === 'Admin access required' ? 403 : 500
    );
  }
};
