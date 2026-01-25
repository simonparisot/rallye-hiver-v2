import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getGameStatus, initializeGameStatus, getUserById, getTeamById } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { getUserIdFromEvent } from '../../utils/auth';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

// Create JWT verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: 'access',
  clientId: COGNITO_CLIENT_ID,
});

/**
 * Public endpoint to check game status
 * No authentication required - allows frontend to show waiting state
 * Returns whether the game has started
 *
 * Special behavior: If user is authenticated and their team is marked as isBetaTeam,
 * the game appears as started (early access for beta teams)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Try to get userId from authorizer first (if endpoint has authorizer)
    let userId = getUserIdFromEvent(event);

    // If no userId from authorizer, try to manually verify JWT token
    if (!userId && event.headers?.Authorization) {
      try {
        const token = event.headers.Authorization.replace('Bearer ', '');
        const payload = await verifier.verify(token);
        const cognitoSub = payload.sub as string;

        // Get user from database using cognitoSub
        const { getUserByCognitoSub } = await import('../../utils/dynamodb');
        const user = await getUserByCognitoSub(cognitoSub);
        if (user) {
          userId = user.userId;
          console.log(`Authenticated via JWT: userId=${userId}, cognitoSub=${cognitoSub}`);
        }
      } catch (jwtErr) {
        // Token invalid or expired - continue as unauthenticated user
        console.log('JWT verification failed (continuing as unauthenticated):', jwtErr);
      }
    }

    // Also check lowercase 'authorization' header
    if (!userId && event.headers?.authorization) {
      try {
        const token = event.headers.authorization.replace('Bearer ', '');
        const payload = await verifier.verify(token);
        const cognitoSub = payload.sub as string;

        // Get user from database using cognitoSub
        const { getUserByCognitoSub } = await import('../../utils/dynamodb');
        const user = await getUserByCognitoSub(cognitoSub);
        if (user) {
          userId = user.userId;
          console.log(`Authenticated via JWT (lowercase): userId=${userId}, cognitoSub=${cognitoSub}`);
        }
      } catch (jwtErr) {
        console.log('JWT verification failed (continuing as unauthenticated):', jwtErr);
      }
    }

    if (userId) {
      // User is authenticated - check if they're in a beta team
      try {
        const user = await getUserById(userId);
        console.log(`User found: userId=${userId}, teamId=${user?.teamId}`);

        if (user?.teamId) {
          const team = await getTeamById(user.teamId);
          console.log(`Team found: teamName=${team?.teamName}, isBetaTeam=${team?.isBetaTeam}`);

          if (team?.isBetaTeam === true) {
            // This is a beta team - grant early access
            console.log(`✅ BETA TEAM ACCESS GRANTED for ${team.teamName}`);
            return success({
              isStarted: true,
              startedAt: new Date().toISOString(),
            });
          } else {
            console.log(`❌ NOT a beta team: ${team?.teamName}`);
          }
        } else {
          console.log('User has no team');
        }
      } catch (userCheckErr) {
        // If user check fails, continue with normal flow (don't break public access)
        console.warn('Failed to check user beta team status:', userCheckErr);
      }
    } else {
      console.log('No authenticated user - returning real game status');
    }

    // Normal flow: Get actual game status
    let gameStatus = await getGameStatus();

    // If game status doesn't exist, initialize it
    if (!gameStatus) {
      try {
        gameStatus = await initializeGameStatus();
      } catch (err: any) {
        // If initialization fails due to concurrent creation, fetch again
        if (err.name === 'ConditionalCheckFailedException') {
          gameStatus = await getGameStatus();
        } else {
          throw err;
        }
      }
    }

    // Return only public fields (don't expose startedBy for privacy)
    return success({
      isStarted: gameStatus.isStarted,
      startedAt: gameStatus.startedAt || null,
    });
  } catch (err: any) {
    console.error('Get game status error:', err);
    return error(err.message || 'Failed to get game status', 500);
  }
};
