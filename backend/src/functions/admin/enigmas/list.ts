import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllEnigmasForAdmin } from '../../../utils/dynamodb';
import { dynamoDb, PASSWORD_ATTEMPTS_TABLE, TEAM_ENIGMA_PROGRESS_TABLE } from '../../../utils/dynamodb';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin list enigmas endpoint with statistics
 * Returns all enigmas (including inactive ones) with attempt stats
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Get all enigmas (including inactive ones for admin)
    const enigmas = await getAllEnigmasForAdmin();

    // Enhance each enigma with statistics
    const enigmasWithStats = await Promise.all(
      enigmas.map(async (enigma: any) => {
        // Get total attempts for this enigma
        const attemptsResult = await dynamoDb.send(
          new QueryCommand({
            TableName: PASSWORD_ATTEMPTS_TABLE,
            IndexName: 'enigmaId-attemptedAt-index',
            KeyConditionExpression: 'enigmaId = :enigmaId',
            ExpressionAttributeValues: {
              ':enigmaId': enigma.enigmaId,
            },
          })
        );
        const attempts = attemptsResult.Items || [];
        const totalAttempts = attempts.length;
        const successfulAttempts = attempts.filter((a: any) => a.success).length;

        // Get teams that solved this enigma
        const progressResult = await dynamoDb.send(
          new QueryCommand({
            TableName: TEAM_ENIGMA_PROGRESS_TABLE,
            IndexName: 'enigmaId-solvedAt-index',
            KeyConditionExpression: 'enigmaId = :enigmaId',
            FilterExpression: 'solved = :solved',
            ExpressionAttributeValues: {
              ':enigmaId': enigma.enigmaId,
              ':solved': true,
            },
          })
        );
        const teamsSolved = progressResult.Items?.length || 0;

        return {
          ...enigma,
          totalAttempts,
          successfulAttempts,
          teamsSolved,
        };
      })
    );

    // Sort by enigmaNumber
    enigmasWithStats.sort((a, b) => a.enigmaNumber - b.enigmaNumber);

    return success({
      enigmas: enigmasWithStats,
      count: enigmasWithStats.length,
    });
  } catch (err: any) {
    console.error('Admin list enigmas error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch enigmas', 500);
  }
};
