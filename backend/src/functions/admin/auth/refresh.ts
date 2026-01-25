import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { success, error } from '../../../utils/response';

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const USER_POOL_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

/**
 * Refresh access token using refresh token (admin)
 * POST /admin/auth/refresh
 * Body: { refreshToken: string }
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { refreshToken } = body;

    if (!refreshToken) {
      return error('Refresh token is required', 400);
    }

    // Use Cognito's REFRESH_TOKEN_AUTH flow
    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: USER_POOL_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      return error('Failed to refresh token', 401);
    }

    return success({
      accessToken: response.AuthenticationResult.AccessToken,
      idToken: response.AuthenticationResult.IdToken,
      expiresIn: response.AuthenticationResult.ExpiresIn,
    });
  } catch (err: any) {
    console.error('Admin refresh token error:', err);

    if (err.name === 'NotAuthorizedException') {
      return error('Invalid or expired refresh token', 401);
    }

    return error(err.message || 'Failed to refresh token', 500);
  }
};
