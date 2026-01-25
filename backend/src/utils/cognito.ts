import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminInitiateAuthCommand, AdminGetUserCommand, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'eu-west-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

export async function signUp(email: string, password: string, displayName: string) {
  let userCreated = false;

  try {
    // Create user in Cognito
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'email_verified',
          Value: 'true',
        },
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
    });

    const createResult = await cognitoClient.send(createUserCommand);
    userCreated = true;

    // Set permanent password
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    });

    await cognitoClient.send(setPasswordCommand);

    return createResult.User;
  } catch (error: any) {
    // If user was created but password setting failed, clean up
    if (userCreated) {
      console.error('Password setting failed, cleaning up created user:', error.message);
      try {
        const deleteCommand = new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
        });
        await cognitoClient.send(deleteCommand);
        console.log('Successfully cleaned up user after password failure');
      } catch (deleteError: any) {
        console.error('Failed to clean up user:', deleteError.message);
      }
    }

    // Re-throw the original error with helpful message
    if (error.name === 'InvalidPasswordException') {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre');
    }

    throw error;
  }
}

export async function signIn(email: string, password: string) {
  const command = new AdminInitiateAuthCommand({
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID,
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  const result = await cognitoClient.send(command);

  return {
    accessToken: result.AuthenticationResult?.AccessToken,
    refreshToken: result.AuthenticationResult?.RefreshToken,
    idToken: result.AuthenticationResult?.IdToken,
  };
}

export async function getCognitoUser(username: string) {
  const command = new AdminGetUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  });

  const result = await cognitoClient.send(command);

  return result;
}
