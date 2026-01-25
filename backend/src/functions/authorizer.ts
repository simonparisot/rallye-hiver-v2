import { APIGatewayAuthorizerResult } from '../types';
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { getUserByCognitoSub } from '../utils/dynamodb';

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export const handler = async (event: any): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer event:', JSON.stringify(event, null, 2));

  try {
    // Handle both Authorization and authorization headers
    const authHeader = event.headers?.Authorization || event.headers?.authorization || event.authorizationToken || '';
    const token = authHeader.replace('Bearer ', '').replace('bearer ', '');

    if (!token) {
      throw new Error('No token provided');
    }

    // Verify the JWT token
    const decoded: any = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });

    console.log('Decoded token:', decoded);

    const cognitoSub = decoded.sub;

    // Get user from database
    const user = await getUserByCognitoSub(cognitoSub);

    if (!user) {
      throw new Error('User not found in database');
    }

    // Generate policy - use wildcard Resource for all endpoints
    // Extract the API Gateway ARN and replace the specific path with wildcard
    const methodArn = event.methodArn || event.routeArn || '';
    const arnParts = methodArn.split('/');
    const apiGatewayArn = arnParts.slice(0, 2).join('/') + '/*';

    const policy: APIGatewayAuthorizerResult = {
      principalId: user.userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: apiGatewayArn || '*',
          },
        ],
      },
      context: {
        cognitoSub: cognitoSub,
        userId: user.userId,
        email: user.email,
      },
    };

    console.log('Generated policy:', JSON.stringify(policy, null, 2));
    return policy;
  } catch (error) {
    console.error('Authorization failed:', error);
    throw new Error('Unauthorized');
  }
};
