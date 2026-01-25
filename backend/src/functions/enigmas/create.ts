import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { createEnigma } from '../../utils/dynamodb';
import { requireAdmin } from '../../utils/adminAuth';
import { success, error } from '../../utils/response';
import { Enigma } from '../../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const body = JSON.parse(event.body || '{}');

    // Validate required fields (only title, pdfUrl, correctPassword are mandatory)
    if (!body.title || !body.pdfUrl || !body.correctPassword) {
      return error('Missing required fields: title, pdfUrl, correctPassword', 400);
    }

    const now = new Date().toISOString();

    // Auto-assign enigmaNumber if not provided (find max + 1)
    let enigmaNumber = body.enigmaNumber;
    if (!enigmaNumber) {
      // Get all enigmas to find the highest enigmaNumber
      const { getAllEnigmas } = await import('../../utils/dynamodb');
      const allEnigmas = await getAllEnigmas();
      const maxNumber = allEnigmas.length > 0
        ? Math.max(...allEnigmas.map(e => e.enigmaNumber || 0))
        : 0;
      enigmaNumber = maxNumber + 1;
    }

    const enigma: Enigma = {
      enigmaId: uuidv4(),
      enigmaNumber: enigmaNumber,
      title: body.title,
      description: body.description || '',
      pdfUrl: body.pdfUrl,
      correctPassword: body.correctPassword,
      points: body.points || 10, // Default to 10 points if not provided
      difficulty: body.difficulty || 'medium',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: now,
      updatedAt: now,
      gameId: body.gameId,
    };

    await createEnigma(enigma);

    return success({
      message: 'Enigma created successfully',
      enigma,
    });
  } catch (err: any) {
    console.error('Error creating enigma:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to create enigma');
  }
};
