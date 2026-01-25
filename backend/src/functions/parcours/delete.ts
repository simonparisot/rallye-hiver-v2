import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { deleteParcours, getParcoursById } from '../../utils/dynamodb';
import { requireAdmin } from '../../utils/adminAuth';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const parcoursId = event.pathParameters?.parcoursId;

    if (!parcoursId) {
      return error('Missing parcoursId parameter', 400);
    }

    const existingParcours = await getParcoursById(parcoursId);
    if (!existingParcours) {
      return error('Parcours not found', 404);
    }

    await deleteParcours(parcoursId);

    return success({
      message: 'Parcours deleted successfully',
    });
  } catch (err: any) {
    console.error('Error deleting parcours:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to delete parcours');
  }
};
