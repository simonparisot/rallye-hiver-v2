import { dynamoDb, TEAMS_TABLE } from './dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Test teams stay fully functional (they must keep playing for the automated
 * test suite) but are hidden from every list and every statistic, so that the
 * figures shown to participants and admins only reflect real players.
 *
 * Source of truth: the `isTestTeam` flag carried by the team record.
 * The optional TEST_TEAM_IDS environment variable (comma separated teamIds) is
 * a safety net for a team whose flag has not been set on the record yet.
 */

// Lambda containers are reused between invocations, so a short-lived module
// level cache avoids one Scan per request without letting the list go stale.
const TEST_TEAM_IDS_TTL_MS = 5 * 60 * 1000;

let cachedTestTeamIds: Set<string> | null = null;
let cachedAt = 0;

function getTestTeamIdsFromEnv(): string[] {
  return (process.env.TEST_TEAM_IDS || '')
    .split(',')
    .map((teamId) => teamId.trim())
    .filter((teamId) => teamId.length > 0);
}

/**
 * Check whether an already loaded team record is a test team
 * @param team The team record (may be undefined)
 * @returns true if the team must be hidden from lists and statistics
 */
export function isTestTeam(team: any): boolean {
  if (!team) {
    return false;
  }

  if (team.isTestTeam === true) {
    return true;
  }

  return !!team.teamId && getTestTeamIdsFromEnv().includes(team.teamId);
}

/**
 * Remove the test teams from a list of team records already in memory
 * @param teams The team records to filter
 * @returns The same list without the test teams (no I/O)
 */
export function excludeTestTeams<T>(teams: T[]): T[] {
  return teams.filter((team) => !isTestTeam(team));
}

/**
 * Get the ids of all test teams, for the tables that do not carry the flag
 * @returns The set of test teamIds (memoized for TEST_TEAM_IDS_TTL_MS)
 */
export async function getTestTeamIds(): Promise<Set<string>> {
  const now = Date.now();

  if (cachedTestTeamIds && now - cachedAt < TEST_TEAM_IDS_TTL_MS) {
    return cachedTestTeamIds;
  }

  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: 'isTestTeam = :isTestTeam',
      ProjectionExpression: 'teamId',
      ExpressionAttributeValues: {
        ':isTestTeam': true,
      },
    })
  );

  const testTeamIds = new Set<string>(getTestTeamIdsFromEnv());
  (result.Items || []).forEach((team: any) => {
    testTeamIds.add(team.teamId);
  });

  cachedTestTeamIds = testTeamIds;
  cachedAt = now;

  return testTeamIds;
}

/**
 * Remove the rows belonging to a test team from the tables that only carry a
 * teamId (password-attempts, team-enigma-progress, team-parcours-access)
 * @param rows The rows to filter
 * @param testTeamIds The set returned by getTestTeamIds()
 * @returns The same list without the rows of the test teams
 */
export function excludeTestTeamRows<T extends { teamId?: string }>(rows: T[], testTeamIds: Set<string>): T[] {
  if (testTeamIds.size === 0) {
    return rows;
  }

  return rows.filter((row) => !row.teamId || !testTeamIds.has(row.teamId));
}
