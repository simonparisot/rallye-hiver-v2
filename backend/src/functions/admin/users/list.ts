import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoDb, USERS_TABLE, TEAMS_TABLE } from '../../../utils/dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin list users endpoint
 * Returns users without a team (including those with pending join requests)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Get all users without a team (handle both missing attribute and null value)
    const usersResult = await dynamoDb.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: 'attribute_not_exists(teamId) OR attribute_type(teamId, :nullType)',
        ExpressionAttributeValues: {
          ':nullType': 'NULL',
        },
      })
    );

    const users = usersResult.Items || [];

    // Get all teams to check for pending requests
    const teamsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TEAMS_TABLE,
      })
    );

    const teams = teamsResult.Items || [];

    // Build a map of userId -> pending team info
    const pendingRequestsMap = new Map<string, { teamId: string; teamName: string }>();

    teams.forEach((team: any) => {
      const pendingRequests = team.pendingRequests || [];
      pendingRequests.forEach((requestUserId: string) => {
        pendingRequestsMap.set(requestUserId, {
          teamId: team.teamId,
          teamName: team.teamName,
        });
      });
    });

    // Enhance users with pending request information
    const usersWithPendingInfo = users.map((user: any) => {
      const pendingRequest = pendingRequestsMap.get(user.userId);

      return {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        hasPendingRequest: !!pendingRequest,
        pendingTeamName: pendingRequest?.teamName || null,
        createdAt: user.createdAt,
      };
    });

    // Sort by creation date (newest first)
    usersWithPendingInfo.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return success({
      users: usersWithPendingInfo,
      count: usersWithPendingInfo.length,
    });
  } catch (err: any) {
    console.error('Admin list users error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch users', 500);
  }
};
