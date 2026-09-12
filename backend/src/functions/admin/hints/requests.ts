import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  dynamoDb,
  scanHintRequests,
  TEAMS_TABLE,
  ENIGMAS_TABLE,
} from '../../../utils/dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { getTestTeamIds, excludeTestTeamRows } from '../../../utils/testTeams';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Journal des demandes d'indices.
 *
 * GET /admin/hints/requests?enigmaId=&teamId=&sort=asc|desc&limit=&cursor=
 *
 * C'est l'outil d'evaluation de l'essai : le texte d'avancement envoye par
 * l'equipe, l'indice choisi, la date et les points factures, sans troncature.
 *
 * La table n'a pas d'index de tri global : le parcours ramene tout, puis filtre
 * et trie en memoire. Le volume attendu (quelques centaines de demandes par
 * edition) le permet largement ; la pagination porte donc sur le resultat trie,
 * ce qui evite les curseurs incoherents entre deux filtres.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) {
      return error('Authentication required', 401);
    }

    await requireAdmin(userId);

    const params = event.queryStringParameters || {};
    const filtreEnigme = params.enigmaId || null;
    const filtreEquipe = params.teamId || null;
    const sens = params.sort === 'asc' ? 'asc' : 'desc';
    const limite = Math.min(Math.max(parseInt(params.limit || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(params.cursor || '0', 10) || 0, 0);

    // Parcours complet de la table, page par page.
    let toutes: any[] = [];
    let lastKey: any = undefined;
    do {
      const page = await scanHintRequests(500, lastKey);
      toutes = toutes.concat(page.items);
      lastKey = page.lastKey;
    } while (lastKey);

    // Les equipes de test jouent des scenarios automatises : elles fausseraient
    // la lecture du journal comme elles faussent les statistiques.
    const testTeamIds = await getTestTeamIds();
    let demandes = excludeTestTeamRows(toutes, testTeamIds);

    if (filtreEnigme) {
      demandes = demandes.filter((d: any) => d.enigmaId === filtreEnigme);
    }
    if (filtreEquipe) {
      demandes = demandes.filter((d: any) => d.teamId === filtreEquipe);
    }

    demandes.sort((a: any, b: any) => {
      const da = a.requestedAt || '';
      const db = b.requestedAt || '';
      return sens === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
    });

    const total = demandes.length;
    const page = demandes.slice(offset, offset + limite);

    // Enrichissement limite a la page renvoyee.
    const cacheEquipes = new Map<string, any>();
    const cacheEnigmes = new Map<string, any>();

    const enrichies = await Promise.all(
      page.map(async (d: any) => {
        if (!cacheEquipes.has(d.teamId)) {
          const r = await dynamoDb.send(
            new GetCommand({ TableName: TEAMS_TABLE, Key: { teamId: d.teamId } })
          );
          cacheEquipes.set(d.teamId, r.Item);
        }
        if (!cacheEnigmes.has(d.enigmaId)) {
          const r = await dynamoDb.send(
            new GetCommand({ TableName: ENIGMAS_TABLE, Key: { enigmaId: d.enigmaId } })
          );
          cacheEnigmes.set(d.enigmaId, r.Item);
        }
        const equipe = cacheEquipes.get(d.teamId);
        const enigme = cacheEnigmes.get(d.enigmaId);

        return {
          requestId: d.requestId,
          teamId: d.teamId,
          teamName: equipe?.teamName || 'Equipe inconnue',
          enigmaId: d.enigmaId,
          enigmaNumber: enigme?.enigmaNumber || 0,
          enigmaTitle: enigme?.title || 'Enigme inconnue',
          requestedAt: d.requestedAt,
          requestedBy: d.requestedBy,
          progressText: d.progressText,
          hintId: d.hintId,
          hintText: d.hintText,
          justification: d.justification,
          model: d.model,
          inputTokens: d.inputTokens,
          outputTokens: d.outputTokens,
          pointsCharged: d.pointsCharged || 0,
        };
      })
    );

    const suivant = offset + limite < total ? String(offset + limite) : null;

    // Les facettes sont calculees sur l'ensemble filtre par les autres criteres
    // seulement si aucun filtre n'est pose : sinon la liste deroulante se vide
    // des qu'on selectionne une valeur.
    const facettes = excludeTestTeamRows(toutes, testTeamIds);

    return success({
      requests: enrichies,
      total,
      limit: limite,
      cursor: suivant,
      stats: {
        totalRequests: facettes.length,
        uniqueTeams: new Set(facettes.map((d: any) => d.teamId)).size,
        uniqueEnigmas: new Set(facettes.map((d: any) => d.enigmaId)).size,
        totalPointsCharged: facettes.reduce((s: number, d: any) => s + (d.pointsCharged || 0), 0),
      },
    });
  } catch (err: any) {
    console.error('Admin hint requests error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch hint requests', 500);
  }
};
