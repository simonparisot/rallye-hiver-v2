import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { updateParcours, getParcoursById } from '../../utils/dynamodb';
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

    const body = JSON.parse(event.body || '{}');

    // Build updates object with allowed fields
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.pdfUrl !== undefined) updates.pdfUrl = body.pdfUrl;
    if (body.requiredEnigmaIds !== undefined) updates.requiredEnigmaIds = body.requiredEnigmaIds;
    if (body.requiredEnigmasCount !== undefined) updates.requiredEnigmasCount = body.requiredEnigmasCount;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    const updatedParcours = await updateParcours(parcoursId, updates);

    return success({
      message: 'Parcours updated successfully',
      parcours: updatedParcours,
    });
  } catch (err: any) {
    console.error('Error updating parcours:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to update parcours');
  }
};
