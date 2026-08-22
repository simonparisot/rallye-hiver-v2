import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllTeams, getAllTeamProgress, getUsersByIds } from '../../../utils/dynamodb';
import { dynamoDb, TEAM_PARCOURS_ACCESS_TABLE, PASSWORD_ATTEMPTS_TABLE } from '../../../utils/dynamodb';
import { excludeTestTeams } from '../../../utils/testTeams';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin list teams endpoint
 * Returns all teams with progress statistics
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Get all teams (test teams are hidden from the admin list as well)
    const teamsResult = await getAllTeams(10000); // High limit to get all teams
    const teams = excludeTestTeams(teamsResult.items || []);

    // Enhance each team with progress statistics
    const teamsWithProgress = await Promise.all(
      teams.map(async (team: any) => {
        // Get team member details
        const members = await getUsersByIds(team.members || []);

        // Get team's solved enigmas count
        const progressResult = await getAllTeamProgress(team.teamId);
        const solvedEnigmasCount = progressResult.filter((p: any) => p.solved).length;

        // Get team's unlocked parcours count
        const parcoursAccessResult = await dynamoDb.send(
          new QueryCommand({
            TableName: TEAM_PARCOURS_ACCESS_TABLE,
            KeyConditionExpression: 'teamId = :teamId',
            ExpressionAttributeValues: {
              ':teamId': team.teamId,
            },
          })
        );
        const unlockedParcoursCount = parcoursAccessResult.Items?.length || 0;

        // Get team's total attempts count
        const attemptsResult = await dynamoDb.send(
          new QueryCommand({
            TableName: PASSWORD_ATTEMPTS_TABLE,
            IndexName: 'teamId-attemptedAt-index',
            KeyConditionExpression: 'teamId = :teamId',
            ExpressionAttributeValues: {
              ':teamId': team.teamId,
            },
          })
        );
        const totalAttempts = attemptsResult.Items?.length || 0;

        // Get last activity timestamp (most recent attempt)
        const lastActivityAt =
          attemptsResult.Items && attemptsResult.Items.length > 0
            ? attemptsResult.Items[0].attemptedAt
            : team.createdAt;

        return {
          ...team,
          members: members.map((m: any) => ({
            userId: m.userId,
            displayName: m.displayName,
            email: m.email,
            role: m.role,
          })),
          solvedEnigmasCount,
          unlockedParcoursCount,
          totalAttempts,
          lastActivityAt,
        };
      })
    );

    return success({
      teams: teamsWithProgress,
      count: teamsWithProgress.length,
    });
  } catch (err: any) {
    console.error('Admin list teams error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch teams', 500);
  }
};
