import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { signUp } from '../../utils/cognito';
import { createUser } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Signup event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password, displayName } = body;

    // Validate input
    if (!email || !password || !displayName) {
      return errorResponse('Email, password, and display name are required', 400);
    }

    // Create user in Cognito
    const cognitoUser = await signUp(email, password, displayName);

    const cognitoSub = cognitoUser?.Attributes?.find(attr => attr.Name === 'sub')?.Value;

    if (!cognitoSub) {
      throw new Error('Failed to get Cognito sub from user');
    }

    // Create user in DynamoDB
    const userId = uuidv4();
    const now = new Date().toISOString();

    const user = await createUser({
      userId,
      cognitoSub,
      email,
      displayName,
      teamId: null,
      role: null,
      createdAt: now,
      updatedAt: now,
    });

    return successResponse({
      message: 'User created successfully',
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
      },
    }, 201);
  } catch (error: any) {
    console.error('Signup error:', error);
    return errorResponse(error.message || 'Failed to create user', 500);
  }
};
