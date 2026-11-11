import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { createParcours, getAllParcoursForAdmin } from '../../utils/dynamodb';
import { validateRequiredEnigmaIds } from '../../utils/parcoursAccess';
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

    if (!body.title || !body.pdfUrl) {
      return error('Champs obligatoires : title, pdfUrl', 400);
    }

    // Aucune intrigue requise : la tournée est ouverte à toutes les équipes.
    const requiredEnigmaIds = body.requiredEnigmaIds ?? [];
    const invalid = await validateRequiredEnigmaIds(requiredEnigmaIds);
    if (invalid) {
      return error(invalid, 400);
    }

    // Le formulaire ne demande pas de numéro : la tournée prend la place
    // suivant la dernière.
    let parcoursNumber = body.parcoursNumber;
    if (parcoursNumber === undefined) {
      const existing = await getAllParcoursForAdmin();
      parcoursNumber = existing.reduce((max: number, p: any) => Math.max(max, p.parcoursNumber || 0), 0) + 1;
    } else if (!Number.isInteger(parcoursNumber) || parcoursNumber < 1) {
      return error('parcoursNumber doit être un entier positif', 400);
    }

    const now = new Date().toISOString();

    const parcours: Parcours = {
      parcoursId: uuidv4(),
      parcoursNumber,
      title: body.title,
      description: body.description || '',
      pdfUrl: body.pdfUrl,
      requiredEnigmaIds,
      requiredEnigmasCount: requiredEnigmaIds.length,
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
