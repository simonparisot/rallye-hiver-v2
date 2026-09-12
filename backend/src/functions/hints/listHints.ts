import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getEnigmaById,
  getUserById,
  getTeamById,
  getHintRequestsByTeamAndEnigma,
} from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { ordonnerIndices } from './requestHint';

/**
 * Demandes d'indice de l'équipe sur une énigme, avec leur statut.
 *
 * GET /hints/{enigmaId}
 *
 * C'est aussi l'endpoint que le frontend interroge en boucle après une demande,
 * jusqu'à ce qu'elle soit conclue. Il n'expose que les indices déjà livrés : les
 * indices non obtenus ne sortent jamais du backend, et une demande encore en
 * attente ne porte évidemment aucun texte.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) {
      return error('Unauthorized', 401);
    }

    const enigmaId = event.pathParameters?.enigmaId;
    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('Vous devez appartenir à une équipe pour consulter vos indices', 403);
    }

    const team = await getTeamById(user.teamId);
    if (!team) {
      return error('Team not found', 404);
    }
    if (!team.hasPaid) {
      return error("Votre équipe doit avoir réglé son inscription pour accéder aux indices", 403);
    }

    const enigma = await getEnigmaById(enigmaId);
    if (!enigma) {
      return error('Enigma not found', 404);
    }

    const tousLesIndices = ordonnerIndices(enigma.hints);
    const demandes = await getHintRequestsByTeamAndEnigma(user.teamId, enigmaId);

    // Les demandes, dans l'ordre, avec juste ce qu'il faut au joueur. `processing`
    // est replié sur `pending` : la distinction regarde le worker, pas l'équipe,
    // qui n'a qu'une question, « est-ce prêt ».
    const suivi = demandes.map((d: any) => ({
      requestId: d.requestId,
      status: d.status === 'processing' ? 'pending' : d.status || 'done',
      requestedAt: d.requestedAt,
      pointsCharged: d.pointsCharged || 0,
      ...(d.status === 'done' && d.hintId
        ? { hint: { id: d.hintId, text: d.hintText } }
        : {}),
      ...(d.status === 'failed' ? { failureReason: d.failureReason } : {}),
    }));

    const livres = suivi.filter((d: any) => d.status === 'done');
    const enAttente = suivi.some((d: any) => d.status === 'pending');

    // Les indices déjà obtenus, pour relecture.
    const obtenus = demandes
      .filter((d: any) => d.status === 'done' && d.hintId)
      .map((d: any) => ({
        id: d.hintId,
        text: d.hintText,
        requestedAt: d.requestedAt,
        pointsCharged: d.pointsCharged || 0,
      }));

    const idsObtenus = new Set(obtenus.map((h: any) => h.id));
    const restants = tousLesIndices.filter((h) => !idsObtenus.has(h.id)).length;

    return success({
      enigmaId,
      hints: obtenus,
      requests: suivi,
      hintsRequested: livres.length,
      remainingHints: restants,
      pendingRequest: enAttente,
      enigmaPoints: enigma.points || 0,
      // Coût nul pendant l'essai : le barème dort dans utils/hintCost.ts.
      nextHintCost: 0,
      totalPointsCharged: obtenus.reduce((somme: number, h: any) => somme + (h.pointsCharged || 0), 0),
    });
  } catch (err: any) {
    console.error('Error listing hints:', err);
    return error(err.message || 'Failed to list hints');
  }
};
