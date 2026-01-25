import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getEnigmaById,
  getUserById,
  getTeamById,
  getTeamProgress,
  createOrUpdateTeamProgress,
} from '../../utils/dynamodb';
import { success, error } from '../../utils/response';

/**
 * Use hint endpoint
 * Allows a team to use a hint for an enigma (25% point cost)
 *
 * POST /hints/{enigmaId}/use
 *
 * Returns:
 * - success: boolean
 * - hintPdfUrl: string (the hint PDF URL)
 * - isFirstUse: boolean (true if this is the first time using the hint)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Unauthorized', 401);
    }

    const enigmaId = event.pathParameters?.enigmaId;

    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    // Get user and verify team membership
    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('User must be in a team to use hints', 403);
    }

    const team = await getTeamById(user.teamId);
    if (!team) {
      return error('Team not found', 404);
    }

    // Check if team has paid
    if (!team.hasPaid) {
      return error('Team must complete payment to use hints', 403);
    }

    // Get enigma
    const enigma = await getEnigmaById(enigmaId);
    if (!enigma) {
      return error('Enigma not found', 404);
    }

    if (!enigma.isActive) {
      return error('This enigma is not currently active', 403);
    }

    // Check if enigma has a hint
    if (!enigma.hintPdfUrl) {
      return error('No hint available for this enigma', 404);
    }

    const now = new Date().toISOString();

    // Check if hint was already used
    const existingProgress = await getTeamProgress(user.teamId, enigmaId);
    const alreadyUsedHint = existingProgress?.hintUsed === true;

    if (alreadyUsedHint) {
      // Hint already used - just return the URL without recording again
      return success({
        success: true,
        hintPdfUrl: enigma.hintPdfUrl,
        isFirstUse: false,
      });
    }

    // First time using hint - record it
    const progressUpdates: any = {
      hintUsed: true,
      hintUsedAt: now,
      updatedAt: now,
    };

    if (!existingProgress) {
      // Create new progress entry if none exists
      progressUpdates.solved = false;
      progressUpdates.attemptCount = 0;
      progressUpdates.createdAt = now;
    }

    await createOrUpdateTeamProgress(user.teamId, enigmaId, progressUpdates);

    return success({
      success: true,
      hintPdfUrl: enigma.hintPdfUrl,
      isFirstUse: true,
    });
  } catch (err: any) {
    console.error('Error using hint:', err);
    return error(err.message || 'Failed to use hint');
  }
};
