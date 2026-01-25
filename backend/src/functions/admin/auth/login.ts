import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getUserByEmail } from '../../../utils/dynamodb';
import { success, error } from '../../../utils/response';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'eu-west-1',
});

/**
 * Admin login endpoint
 * Authenticates user and verifies admin status
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = body;

    if (!email || !password) {
      return error('Email and password are required', 400);
    }

    // Authenticate with Cognito
    const authResult = await cognito.send(
      new AdminInitiateAuthCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
    );

    if (!authResult.AuthenticationResult) {
      return error('Authentication failed', 401);
    }

    // Get user from database by email
    const user = await getUserByEmail(email);

    if (!user) {
      return error('User not found', 404);
    }

    // Verify admin status
    if (!user.isAdmin) {
      return error('Admin access required', 403);
    }

    return success({
      accessToken: authResult.AuthenticationResult.AccessToken,
      refreshToken: authResult.AuthenticationResult.RefreshToken,
      idToken: authResult.AuthenticationResult.IdToken,
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err: any) {
    console.error('Admin login error:', err);

    if (err.name === 'NotAuthorizedException') {
      return error('Invalid email or password', 401);
    }

    if (err.name === 'UserNotFoundException') {
      return error('User not found', 404);
    }

    return error(err.message || 'Failed to login', 500);
  }
};
