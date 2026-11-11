import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { resetGame } from '../../../utils/dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { etatJeuAdmin } from './status';

/**
 * POST /admin/game/reset — { launchAt? }
 *
 * Revient en avant-lancement : `isStarted` repasse à false. Indispensable pour
 * essayer l'avant-lancement sur test, où le jeu est déjà lancé.
 *
 * La phase reste « lance » si l'heure de lancement est passée : `launchAt`
 * (ISO 8601, dans le futur) la repousse. Sans `launchAt`, l'heure en vigueur
 * est conservée. La réponse dit la phase obtenue.
 *
 * Rien n'est effacé : les progressions, tentatives et déblocages de thème des
 * équipes restent ce qu'ils sont.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) {
      return error('Authentication required', 401);
    }
    await requireAdmin(userId);

    let body: any;
    try {
      body = JSON.parse(event.body || '{}') ?? {};
    } catch {
      return error('Corps invalide', 400);
    }

    let launchAt: string | undefined;
    if (body.launchAt !== undefined && body.launchAt !== null && body.launchAt !== '') {
      const instant = typeof body.launchAt === 'string' ? Date.parse(body.launchAt) : NaN;
      if (Number.isNaN(instant)) {
        return error('launchAt doit être une date ISO 8601', 400);
      }
      if (instant <= Date.now()) {
        return error('launchAt doit être dans le futur', 400);
      }
      launchAt = new Date(instant).toISOString();
    }

    const statut = await resetGame(userId, launchAt);

    return success({
      message: 'Game back to pre-launch',
      ...etatJeuAdmin(statut),
    });
  } catch (err: any) {
    console.error('Reset game error:', err);
    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }
    return error(err.message || 'Failed to reset game', 500);
  }
};
