import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById } from '../../../utils/dynamodb';
import { success, error } from '../../../utils/response';

/**
 * Admin verify endpoint
 * Verifies that the authenticated user has admin privileges
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Get user from database
    const user = await getUserById(userId);

    if (!user) {
      return error('User not found', 404);
    }

    // Verify admin status
    if (!user.isAdmin) {
      return error('Admin access required', 403);
    }

    return success({
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err: any) {
    console.error('Admin verify error:', err);
    return error(err.message || 'Failed to verify admin status', 500);
  }
};
