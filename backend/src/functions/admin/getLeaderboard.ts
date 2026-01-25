import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllTeams, getUsersByIds } from '../../utils/dynamodb';
import { requireAdmin } from '../../utils/adminAuth';
import { success, error } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const { items: teams } = await getAllTeams(100);

    // Filter only teams that have paid
    const paidTeams = teams.filter((team: any) => team.hasPaid);

    // Sort by points (descending), then by solvedEnigmasCount, then by lastActivityAt
    paidTeams.sort((a: any, b: any) => {
      if ((b.points || 0) !== (a.points || 0)) {
        return (b.points || 0) - (a.points || 0);
      }
      if ((b.solvedEnigmasCount || 0) !== (a.solvedEnigmasCount || 0)) {
        return (b.solvedEnigmasCount || 0) - (a.solvedEnigmasCount || 0);
      }
      // Earlier activity time is better (ascending)
      if (a.lastActivityAt && b.lastActivityAt) {
        return a.lastActivityAt.localeCompare(b.lastActivityAt);
      }
      return 0;
    });

    // Get team members for each team
    const leaderboard = await Promise.all(
      paidTeams.map(async (team: any, index: number) => {
        const members = await getUsersByIds(team.members || []);
        return {
          rank: index + 1,
          teamId: team.teamId,
          teamName: team.teamName,
          points: team.points || 0,
          solvedEnigmasCount: team.solvedEnigmasCount || 0,
          memberCount: members.length,
          lastActivityAt: team.lastActivityAt,
        };
      })
    );

    return success({
      leaderboard,
      totalTeams: leaderboard.length,
    });
  } catch (err: any) {
    console.error('Error getting leaderboard:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to get leaderboard');
  }
};
