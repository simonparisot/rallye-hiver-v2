import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getGameStatus } from '../../../utils/dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { calculerPhase, dateLancement, DATE_LANCEMENT_PAR_DEFAUT } from '../../../utils/gamePhase';

/** Ce que l'administration voit de l'état du jeu, à partir de l'item de statut. */
export function etatJeuAdmin(statut: any, maintenant: Date = new Date()) {
  const launchAt = dateLancement(statut);
  return {
    phase: calculerPhase(statut, maintenant),
    launchAt,
    launchAtIsDefault: launchAt === DATE_LANCEMENT_PAR_DEFAUT,
    // L'heure est-elle passée ? Si oui, revenir en avant-lancement ne suffit
    // plus : il faut aussi repousser l'heure (launchAt).
    launchAtPassed: maintenant.getTime() >= Date.parse(launchAt),
    isStarted: statut?.isStarted === true,
    startedAt: statut?.startedAt || null,
    startedBy: statut?.startedBy || null,
    resetAt: statut?.resetAt || null,
    resetBy: statut?.resetBy || null,
  };
}

/**
 * GET /admin/game/status — phase, heure de lancement et qui a fait quoi.
 * Contrairement à GET /game/status, la réponse ne dépend pas de l'équipe de
 * l'appelant (pas de passe-droit bêta) : c'est la phase de tout le monde.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) {
      return error('Authentication required', 401);
    }
    await requireAdmin(userId);

    return success(etatJeuAdmin(await getGameStatus()));
  } catch (err: any) {
    console.error('Admin game status error:', err);
    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }
    return error(err.message || 'Failed to get game status', 500);
  }
};
