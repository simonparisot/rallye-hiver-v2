import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoDb, TEAM_ENIGMA_PROGRESS_TABLE, TEAMS_TABLE, ENIGMAS_TABLE } from '../../../utils/dynamodb';
import { getTestTeamIds, excludeTestTeamRows } from '../../../utils/testTeams';
import { ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin hint usage endpoint
 * Returns statistics and details about hint usage across all teams
 *
 * GET /admin/hints/usage
 *
 * Returns:
 * - usages: Array of hint usage records with team and enigma details
 * - stats: Summary statistics (total usages, unique teams, unique enigmas)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Scan all team enigma progress records where hintUsed is true
    const progressResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TEAM_ENIGMA_PROGRESS_TABLE,
        FilterExpression: 'hintUsed = :hintUsed',
        ExpressionAttributeValues: {
          ':hintUsed': true,
        },
      })
    );

    // Filtering before the enrichment keeps the test teams out of both the
    // detailed list and the statistics computed from it below
    const testTeamIds = await getTestTeamIds();
    const hintUsages = excludeTestTeamRows(progressResult.Items || [], testTeamIds);

    // Enrich with team and enigma details
    const enrichedUsages = await Promise.all(
      hintUsages.map(async (usage: any) => {
        // Get team details
        const teamResult = await dynamoDb.send(
          new GetCommand({
            TableName: TEAMS_TABLE,
            Key: { teamId: usage.teamId },
          })
        );
        const team = teamResult.Item;

        // Get enigma details
        const enigmaResult = await dynamoDb.send(
          new GetCommand({
            TableName: ENIGMAS_TABLE,
            Key: { enigmaId: usage.enigmaId },
          })
        );
        const enigma = enigmaResult.Item;

        return {
          teamId: usage.teamId,
          teamName: team?.teamName || 'Unknown Team',
          enigmaId: usage.enigmaId,
          enigmaNumber: enigma?.enigmaNumber || 0,
          enigmaTitle: enigma?.title || 'Unknown Enigma',
          hintUsedAt: usage.hintUsedAt,
          solved: usage.solved || false,
          solvedAt: usage.solvedAt,
        };
      })
    );

    // Sort by hintUsedAt (most recent first)
    enrichedUsages.sort((a, b) => {
      const dateA = a.hintUsedAt ? new Date(a.hintUsedAt).getTime() : 0;
      const dateB = b.hintUsedAt ? new Date(b.hintUsedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Calculate statistics
    const uniqueTeams = new Set(hintUsages.map((u: any) => u.teamId));
    const uniqueEnigmas = new Set(hintUsages.map((u: any) => u.enigmaId));
    const solvedAfterHint = hintUsages.filter((u: any) => u.solved).length;

    return success({
      usages: enrichedUsages,
      stats: {
        totalUsages: hintUsages.length,
        uniqueTeams: uniqueTeams.size,
        uniqueEnigmas: uniqueEnigmas.size,
        solvedAfterHint,
      },
    });
  } catch (err: any) {
    console.error('Admin hints usage error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch hint usage', 500);
  }
};
