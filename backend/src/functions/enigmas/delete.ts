import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { deleteEnigma, getEnigmaById } from '../../utils/dynamodb';
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

    const enigmaId = event.pathParameters?.enigmaId;

    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    const existingEnigma = await getEnigmaById(enigmaId);
    if (!existingEnigma) {
      return error('Enigma not found', 404);
    }

    await deleteEnigma(enigmaId);

    return success({
      message: 'Enigma deleted successfully',
    });
  } catch (err: any) {
    console.error('Error deleting enigma:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to delete enigma');
  }
};
