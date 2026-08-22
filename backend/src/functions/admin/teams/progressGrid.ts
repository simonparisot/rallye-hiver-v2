import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { dynamoDb, TEAMS_TABLE, TEAM_ENIGMA_PROGRESS_TABLE, TEAM_PARCOURS_ACCESS_TABLE, ENIGMAS_TABLE, PARCOURS_TABLE } from '../../../utils/dynamodb';
import { excludeTestTeams } from '../../../utils/testTeams';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

/**
 * GET /admin/teams/progress-grid
 *
 * Optimized endpoint for admin progress grid dashboard
 * Returns all teams with their complete progress in a single efficient query
 *
 * This replaces 68+ individual API calls with one aggregated response
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Fetch all data in parallel for maximum performance
    const [teamsResult, enigmasResult, parcoursResult, progressResult, accessResult] = await Promise.all([
      // Get all teams
      dynamoDb.send(new ScanCommand({ TableName: TEAMS_TABLE })),

      // Get all enigmas (to have the full list with enigmaNumber)
      dynamoDb.send(new ScanCommand({ TableName: ENIGMAS_TABLE })),

      // Get all parcours (to have the full list with parcoursNumber)
      dynamoDb.send(new ScanCommand({ TableName: PARCOURS_TABLE })),

      // Get all team enigma progress
      dynamoDb.send(new ScanCommand({ TableName: TEAM_ENIGMA_PROGRESS_TABLE })),

      // Get all team parcours access
      dynamoDb.send(new ScanCommand({ TableName: TEAM_PARCOURS_ACCESS_TABLE })),
    ]);

    // Dropping the test teams here keeps them out of both the grid rows and
    // the metadata.totalTeams counter computed below
    const teams = excludeTestTeams(teamsResult.Items || []);
    const enigmas = enigmasResult.Items || [];
    const parcours = parcoursResult.Items || [];
    const allProgress = progressResult.Items || [];
    const allAccess = accessResult.Items || [];

    // Sort enigmas and parcours by their numbers
    enigmas.sort((a: any, b: any) => (a.enigmaNumber || 0) - (b.enigmaNumber || 0));
    parcours.sort((a: any, b: any) => (a.parcoursNumber || 0) - (b.parcoursNumber || 0));

    // Build lookup maps for O(1) access
    const solvedEnigmasByTeam = new Map<string, Set<string>>();
    const completedParcoursByTeam = new Map<string, Set<string>>();

    // Index all solved enigmas by team
    allProgress.forEach((progress: any) => {
      if (progress.solved) {
        const teamId = progress.teamId;
        if (!solvedEnigmasByTeam.has(teamId)) {
          solvedEnigmasByTeam.set(teamId, new Set());
        }
        solvedEnigmasByTeam.get(teamId)!.add(progress.enigmaId);
      }
    });

    // Index all completed parcours by team
    allAccess.forEach((access: any) => {
      if (access.completed) {
        const teamId = access.teamId;
        if (!completedParcoursByTeam.has(teamId)) {
          completedParcoursByTeam.set(teamId, new Set());
        }
        completedParcoursByTeam.get(teamId)!.add(access.parcoursId);
      }
    });

    // Build the grid data
    const gridData = teams.map((team: any) => {
      const teamId = team.teamId;
      const solvedEnigmas = solvedEnigmasByTeam.get(teamId) || new Set();
      const completedParcours = completedParcoursByTeam.get(teamId) || new Set();

      return {
        teamId,
        teamName: team.teamName,
        hasPaid: team.hasPaid || false,
        isBetaTeam: team.isBetaTeam || false,
        memberCount: (team.members || []).length,
        lastActivityAt: team.lastActivityAt || null,

        // Array of booleans for enigmas (in enigmaNumber order)
        enigmasProgress: enigmas.map((enigma: any) => solvedEnigmas.has(enigma.enigmaId)),

        // Array of booleans for parcours (in parcoursNumber order)
        parcoursProgress: parcours.map((p: any) => completedParcours.has(p.parcoursId)),

        // Summary stats
        solvedCount: solvedEnigmas.size,
        completedParcoursCount: completedParcours.size,
      };
    });

    // Sort teams by name for consistent ordering
    gridData.sort((a, b) => a.teamName.localeCompare(b.teamName));

    return success({
      teams: gridData,
      metadata: {
        totalTeams: teams.length,
        enigmaIds: enigmas.map((e: any) => e.enigmaId),
        enigmaTitles: enigmas.map((e: any) => e.title),
        enigmaNumbers: enigmas.map((e: any) => e.enigmaNumber),
        parcoursIds: parcours.map((p: any) => p.parcoursId),
        parcoursTitles: parcours.map((p: any) => p.title),
        parcoursNumbers: parcours.map((p: any) => p.parcoursNumber),
      },
    });
  } catch (err: any) {
    console.error('Error fetching progress grid:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch progress grid');
  }
};
