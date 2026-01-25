import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoDb, USERS_TABLE, TEAMS_TABLE, PASSWORD_ATTEMPTS_TABLE } from '../../../utils/dynamodb';
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin list all users endpoint
 * Returns ALL users with comprehensive information including team status, attempts, etc.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Get all users
    const usersResult = await dynamoDb.send(
      new ScanCommand({
        TableName: USERS_TABLE,
      })
    );

    const users = usersResult.Items || [];

    // Get all teams to enrich user data
    const teamsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TEAMS_TABLE,
      })
    );

    const teams = teamsResult.Items || [];

    // Build maps for quick lookups
    const teamMap = new Map<string, any>();
    teams.forEach((team: any) => {
      teamMap.set(team.teamId, team);
    });

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

    // Get password attempts count per user
    // We'll scan the attempts table and group by attemptedBy (userId)
    const attemptsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: PASSWORD_ATTEMPTS_TABLE,
        ProjectionExpression: 'attemptedBy',
      })
    );

    const attempts = attemptsResult.Items || [];
    const attemptsCountMap = new Map<string, number>();

    attempts.forEach((attempt: any) => {
      const attemptedBy = attempt.attemptedBy;
      if (attemptedBy) {
        attemptsCountMap.set(attemptedBy, (attemptsCountMap.get(attemptedBy) || 0) + 1);
      }
    });

    // Enhance users with all required information
    const enrichedUsers = users.map((user: any) => {
      const userTeamId = user.teamId;
      const team = userTeamId ? teamMap.get(userTeamId) : null;
      const pendingRequest = pendingRequestsMap.get(user.userId);

      // Determine team status
      let teamStatus: 'no_team' | 'pending' | 'member';
      if (userTeamId && team) {
        teamStatus = 'member';
      } else if (pendingRequest) {
        teamStatus = 'pending';
      } else {
        teamStatus = 'no_team';
      }

      // Check if user is team leader
      const isTeamLeader = team ? team.leaderId === user.userId : false;

      return {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || null, // Will be null until we implement login tracking
        teamId: userTeamId || null,
        teamName: team?.teamName || null,
        isTeamLeader,
        teamStatus,
        pendingTeamName: pendingRequest?.teamName || null,
        passwordAttemptsCount: attemptsCountMap.get(user.userId) || 0,
        isAdmin: user.isAdmin || false,
      };
    });

    // Sort by creation date (newest first)
    enrichedUsers.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return success({
      users: enrichedUsers,
      count: enrichedUsers.length,
    });
  } catch (err: any) {
    console.error('Admin list all users error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch all users', 500);
  }
};
