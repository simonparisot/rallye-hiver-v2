import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllTeams, getAllEnigmas, getAllParcours } from '../../../utils/dynamodb';
import { dynamoDb, USERS_TABLE, PASSWORD_ATTEMPTS_TABLE } from '../../../utils/dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin stats overview endpoint
 * Returns aggregated statistics for the dashboard
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Get all teams
    const teamsResult = await getAllTeams(10000); // Get all teams with high limit
    const teams = teamsResult.items || [];

    // Get all users (to count total players)
    const usersResult = await dynamoDb.send(
      new ScanCommand({
        TableName: USERS_TABLE,
      })
    );
    const users = usersResult.Items || [];

    // Get all enigmas
    const enigmas = await getAllEnigmas();

    // Get all parcours
    const parcours = await getAllParcours();

    // Count teams with payment
    const teamsWithPayment = teams.filter((team: any) => team.hasPaid).length;

    // Get all password attempts
    const attemptsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: PASSWORD_ATTEMPTS_TABLE,
      })
    );
    const attempts = attemptsResult.Items || [];
    const totalAttempts = attempts.length;
    const successfulAttempts = attempts.filter((attempt: any) => attempt.success).length;

    return success({
      totalTeams: teams.length,
      totalPlayers: users.length,
      totalEnigmas: enigmas.length,
      totalParcours: parcours.length,
      teamsWithPayment,
      totalAttempts,
      successfulAttempts,
    });
  } catch (err: any) {
    console.error('Admin stats overview error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch admin stats', 500);
  }
};
