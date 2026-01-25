import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { success, error } from '../../utils/response';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'eu-west-1',
});

/**
 * Reset password endpoint
 * Confirms password reset with verification code
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, code, newPassword } = body;

    if (!email || !code || !newPassword) {
      return error('Email, verification code, and new password are required', 400);
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return error('Password must be at least 8 characters long', 400);
    }

    if (!/[A-Z]/.test(newPassword)) {
      return error('Password must contain at least one uppercase letter', 400);
    }

    if (!/[a-z]/.test(newPassword)) {
      return error('Password must contain at least one lowercase letter', 400);
    }

    if (!/[0-9]/.test(newPassword)) {
      return error('Password must contain at least one number', 400);
    }

    // Confirm password reset
    await cognito.send(
      new ConfirmForgotPasswordCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      })
    );

    return success({
      message: 'Password reset successful. You can now login with your new password',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);

    if (err.name === 'CodeMismatchException') {
      return error('Invalid verification code', 400);
    }

    if (err.name === 'ExpiredCodeException') {
      return error('Verification code has expired. Please request a new one', 400);
    }

    if (err.name === 'InvalidPasswordException') {
      return error('Password does not meet requirements', 400);
    }

    if (err.name === 'UserNotFoundException') {
      return error('User not found', 404);
    }

    if (err.name === 'LimitExceededException') {
      return error('Too many attempts. Please try again later', 429);
    }

    return error(err.message || 'Failed to reset password', 500);
  }
};
