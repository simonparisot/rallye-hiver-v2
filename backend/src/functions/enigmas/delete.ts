import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { deleteEnigma, getEnigmaById } from '../../utils/dynamodb';
import { requireAdmin } from '../../utils/adminAuth';
import { success, error } from '../../utils/response';

/**
 * DELETE /enigmas/{enigmaId} et DELETE /admin/enigmas/{enigmaId} (même
 * fonction, voir serverless.yml). Réservé aux administrateurs.
 *
 * Seul l'enregistrement de l'intrigue est supprimé. L'historique reste tel
 * quel, volontairement :
 * - progression des équipes (team-enigma-progress), tentatives
 *   (password-attempts) et demandes d'indices (hint-requests) gardent leurs
 *   lignes, qui pointent désormais vers une intrigue absente ;
 * - le compteur `solvedEnigmasCount` des équipes n'est pas décrémenté : le
 *   classement continue de compter l'intrigue pour les équipes qui l'avaient
 *   résolue (l'administration le signale avant de confirmer) ;
 * - les tournées qui l'exigeaient gardent son id dans `requiredEnigmaIds`,
 *   mais la règle d'accès ignore les intrigues supprimées
 *   (utils/parcoursAccess).
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const enigmaId = event.pathParameters?.enigmaId;

    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    const existingEnigma = await getEnigmaById(enigmaId);
    if (!existingEnigma) {
      return error('Enigma not found', 404);
    }

    await deleteEnigma(enigmaId);
    console.log(
      `Intrigue supprimée par ${userId} : ${enigmaId} (n°${existingEnigma.enigmaNumber}, ${existingEnigma.title})`
    );

    return success({
      message: 'Enigma deleted successfully',
    });
  } catch (err: any) {
    console.error('Error deleting enigma:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to delete enigma', 500);
  }
};
