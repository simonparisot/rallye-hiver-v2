import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { signIn, getCognitoUser } from '../../utils/cognito';
import { getUserByCognitoSub } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Login event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    // Authenticate with Cognito
    const tokens = await signIn(email, password);

    if (!tokens.accessToken) {
      throw new Error('Failed to authenticate');
    }

    // Get Cognito user to get the sub
    const cognitoUser = await getCognitoUser(email);
    const cognitoSub = cognitoUser.UserAttributes?.find(attr => attr.Name === 'sub')?.Value;

    if (!cognitoSub) {
      throw new Error('Failed to get user sub');
    }

    // Get user from database
    const user = await getUserByCognitoSub(cognitoSub);

    if (!user) {
      return errorResponse('User not found in database', 404);
    }

    return successResponse({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        teamId: user.teamId,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);

    if (error.name === 'NotAuthorizedException') {
      return errorResponse('Invalid email or password', 401);
    }

    return errorResponse(error.message || 'Login failed', 500);
  }
};
