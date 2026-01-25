import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { createParcours } from '../../utils/dynamodb';
import { requireAdmin } from '../../utils/adminAuth';
import { success, error } from '../../utils/response';
import { Parcours } from '../../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.parcoursNumber || !body.title || !body.pdfUrl || !body.requiredEnigmaIds) {
      return error('Missing required fields: parcoursNumber, title, pdfUrl, requiredEnigmaIds', 400);
    }

    const now = new Date().toISOString();

    const parcours: Parcours = {
      parcoursId: uuidv4(),
      parcoursNumber: body.parcoursNumber,
      title: body.title,
      description: body.description || '',
      pdfUrl: body.pdfUrl,
      requiredEnigmaIds: body.requiredEnigmaIds,
      requiredEnigmasCount: body.requiredEnigmasCount || body.requiredEnigmaIds.length,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: now,
      updatedAt: now,
      gameId: body.gameId,
    };

    await createParcours(parcours);

    return success({
      message: 'Parcours created successfully',
      parcours,
    });
  } catch (err: any) {
    console.error('Error creating parcours:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to create parcours');
  }
};
