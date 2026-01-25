import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get me event:', JSON.stringify(event, null, 2));

  try {
    // Get userId from authorizer context (REST API format)
    const userId = event.requestContext?.authorizer?.userId;

    if (!userId) {
      return errorResponse('User ID not found in request context', 401);
    }

    // Get user from database
    const user = await getUserById(userId);

    if (!user) {
      return errorResponse('User not found', 404);
    }

    return successResponse({
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      teamId: user.teamId,
      role: user.role,
    });
  } catch (error: any) {
    console.error('Get me error:', error);
    return errorResponse(error.message || 'Failed to get user', 500);
  }
};
