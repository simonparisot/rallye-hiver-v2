import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { success, error } from '../../../utils/response';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'eu-west-1',
});

/**
 * Admin forgot password endpoint
 * Initiates password reset flow for admin users
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = body;

    if (!email) {
      return error('Email is required', 400);
    }

    // Initiate forgot password flow
    // Note: This works for all users, but admin status is verified during login
    await cognito.send(
      new ForgotPasswordCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
      })
    );

    return success({
      message: 'Password reset code sent to your email',
    });
  } catch (err: any) {
    console.error('Admin forgot password error:', err);

    if (err.name === 'UserNotFoundException') {
      // For security, don't reveal if user exists or not
      return success({
        message: 'If an admin account exists with this email, a password reset code has been sent',
      });
    }

    if (err.name === 'LimitExceededException') {
      return error('Too many requests. Please try again later', 429);
    }

    if (err.name === 'InvalidParameterException') {
      return error('Invalid email address', 400);
    }

    return error(err.message || 'Failed to initiate password reset', 500);
  }
};
