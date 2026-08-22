import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllParcoursForAdmin } from '../../../utils/dynamodb';
import { dynamoDb, TEAM_PARCOURS_ACCESS_TABLE } from '../../../utils/dynamodb';
import { getTestTeamIds, excludeTestTeamRows } from '../../../utils/testTeams';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';

/**
 * Admin list parcours endpoint with statistics
 * Returns all parcours (including inactive ones) with unlock stats
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Get all parcours (including inactive ones for admin)
    const allParcours = await getAllParcoursForAdmin();

    // Get all access records to count unlocks per parcours
    const accessResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TEAM_PARCOURS_ACCESS_TABLE,
      })
    );
    // Test teams unlock parcours as part of their scenarios: excluding their
    // access records keeps the teamsUnlocked counter on real teams only
    const testTeamIds = await getTestTeamIds();
    const accessRecords = excludeTestTeamRows(accessResult.Items || [], testTeamIds);

    // Count unlocks per parcours
    const unlocksMap = new Map<string, number>();
    accessRecords.forEach((record: any) => {
      const count = unlocksMap.get(record.parcoursId) || 0;
      unlocksMap.set(record.parcoursId, count + 1);
    });

    // Enhance each parcours with statistics
    const parcoursWithStats = allParcours.map((parcours: any) => ({
      ...parcours,
      teamsUnlocked: unlocksMap.get(parcours.parcoursId) || 0,
    }));

    // Sort by parcoursNumber
    parcoursWithStats.sort((a, b) => a.parcoursNumber - b.parcoursNumber);

    return success({
      parcours: parcoursWithStats,
      count: parcoursWithStats.length,
    });
  } catch (err: any) {
    console.error('Admin list parcours error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch parcours', 500);
  }
};
