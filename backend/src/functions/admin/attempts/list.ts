import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoDb, PASSWORD_ATTEMPTS_TABLE } from '../../../utils/dynamodb';
import { getTeamById, getEnigmaById, getUserById } from '../../../utils/dynamodb';
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin list attempts endpoint with filtering
 * Returns password attempts with optional filters (success, teamId, enigmaId, pagination)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const successFilter = queryParams.success !== undefined ? queryParams.success === 'true' : undefined;
    const teamId = queryParams.teamId;
    const enigmaId = queryParams.enigmaId;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 100;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;

    // Fetch all attempts (use Query when possible for better performance)
    let allAttempts: any[] = [];

    // Use Query with index when filtering by enigmaId or teamId (much more efficient)
    if (enigmaId) {
      // Query by enigmaId using the index
      let lastEvaluatedKey: any = undefined;
      do {
        const queryParams: any = {
          TableName: PASSWORD_ATTEMPTS_TABLE,
          IndexName: 'enigmaId-attemptedAt-index',
          KeyConditionExpression: 'enigmaId = :enigmaId',
          ExpressionAttributeValues: {
            ':enigmaId': enigmaId,
          },
        };

        // Add filter for success if specified
        if (successFilter !== undefined) {
          queryParams.FilterExpression = 'success = :success';
          queryParams.ExpressionAttributeValues[':success'] = successFilter;
        }

        // Add filter for teamId if specified
        if (teamId) {
          queryParams.FilterExpression = queryParams.FilterExpression
            ? `${queryParams.FilterExpression} AND teamId = :teamId`
            : 'teamId = :teamId';
          queryParams.ExpressionAttributeValues[':teamId'] = teamId;
        }

        if (lastEvaluatedKey) {
          queryParams.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await dynamoDb.send(new QueryCommand(queryParams));
        allAttempts = allAttempts.concat(result.Items || []);
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

    } else if (teamId) {
      // Query by teamId using the index
      let lastEvaluatedKey: any = undefined;
      do {
        const queryParams: any = {
          TableName: PASSWORD_ATTEMPTS_TABLE,
          IndexName: 'teamId-attemptedAt-index',
          KeyConditionExpression: 'teamId = :teamId',
          ExpressionAttributeValues: {
            ':teamId': teamId,
          },
        };

        // Add filter for success if specified
        if (successFilter !== undefined) {
          queryParams.FilterExpression = 'success = :success';
          queryParams.ExpressionAttributeValues[':success'] = successFilter;
        }

        if (lastEvaluatedKey) {
          queryParams.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await dynamoDb.send(new QueryCommand(queryParams));
        allAttempts = allAttempts.concat(result.Items || []);
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

    } else {
      // Scan all attempts with pagination (less efficient, use only when no index filter available)
      let lastEvaluatedKey: any = undefined;
      do {
        const scanParams: any = {
          TableName: PASSWORD_ATTEMPTS_TABLE,
        };

        // Add filter for success if specified
        if (successFilter !== undefined) {
          scanParams.FilterExpression = 'success = :success';
          scanParams.ExpressionAttributeValues = { ':success': successFilter };
        }

        if (lastEvaluatedKey) {
          scanParams.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await dynamoDb.send(new ScanCommand(scanParams));
        allAttempts = allAttempts.concat(result.Items || []);
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    }

    // Sort by attemptedAt descending (most recent first)
    allAttempts.sort((a, b) => {
      const dateA = new Date(a.attemptedAt).getTime();
      const dateB = new Date(b.attemptedAt).getTime();
      return dateB - dateA;
    });

    // Apply pagination
    const total = allAttempts.length;
    const paginatedAttempts = allAttempts.slice(offset, offset + limit);

    // Enhance attempts with team names, enigma titles, and user names
    const enhancedAttempts = await Promise.all(
      paginatedAttempts.map(async (attempt: any) => {
        const team = await getTeamById(attempt.teamId);
        const enigma = await getEnigmaById(attempt.enigmaId);
        const user = attempt.attemptedBy ? await getUserById(attempt.attemptedBy) : null;

        return {
          attemptId: attempt.attemptId,
          teamId: attempt.teamId,
          teamName: team?.teamName || 'Unknown Team',
          enigmaId: attempt.enigmaId,
          enigmaTitle: enigma?.title || 'Unknown Enigma',
          password: attempt.password,
          success: attempt.success,
          attemptedAt: attempt.attemptedAt,
          attemptedBy: attempt.attemptedBy || '',
          attemptedByName: user?.displayName || 'Unknown',
        };
      })
    );

    // Calculate global statistics (on all filtered data, not just paginated)
    const totalSuccessful = allAttempts.filter((a) => a.success).length;
    const activeTeams = new Set(allAttempts.map((a) => a.teamId)).size;

    return success({
      attempts: enhancedAttempts,
      stats: {
        totalAttempts: total,
        totalSuccessful,
        totalFailed: total - totalSuccessful,
        activeTeams,
        successRate: total > 0 ? Math.round((totalSuccessful / total) * 10000) / 100 : 0, // Percentage with 2 decimals
      },
    });
  } catch (err: any) {
    console.error('Admin list attempts error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch attempts', 500);
  }
};
