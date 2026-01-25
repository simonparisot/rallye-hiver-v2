import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getTeamById, getAllTeamProgress, getUsersByIds } from '../../../utils/dynamodb';
import { dynamoDb, TEAM_PARCOURS_ACCESS_TABLE, PASSWORD_ATTEMPTS_TABLE } from '../../../utils/dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin get team by ID endpoint
 * Returns detailed team information with progress statistics
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    const teamId = event.pathParameters?.teamId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    if (!teamId) {
      return error('Team ID is required', 400);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Get team
    const team = await getTeamById(teamId);

    if (!team) {
      return error('Team not found', 404);
    }

    // Get team member details
    const members = await getUsersByIds(team.members || []);

    // Get team's solved enigmas count
    const progressResult = await getAllTeamProgress(teamId);
    const solvedEnigmasCount = progressResult.filter((p: any) => p.solved).length;

    // Get team's unlocked parcours count
    const parcoursAccessResult = await dynamoDb.send(
      new QueryCommand({
        TableName: TEAM_PARCOURS_ACCESS_TABLE,
        KeyConditionExpression: 'teamId = :teamId',
        ExpressionAttributeValues: {
          ':teamId': teamId,
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
          ':teamId': teamId,
        },
      })
    );
    const totalAttempts = attemptsResult.Items?.length || 0;

    // Get last activity timestamp (most recent attempt)
    const lastActivityAt =
      attemptsResult.Items && attemptsResult.Items.length > 0
        ? attemptsResult.Items[0].attemptedAt
        : team.createdAt;

    const teamWithProgress = {
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

    return success({
      team: teamWithProgress,
    });
  } catch (err: any) {
    console.error('Admin get team error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch team', 500);
  }
};
