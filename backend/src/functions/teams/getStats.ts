import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getUserById,
  getTeamById,
  getAllTeamProgress,
  getAllTeamParcoursAccess,
  getAllEnigmas,
  getAllParcours,
  getPasswordAttemptsByTeam,
  dynamoDb,
  PASSWORD_ATTEMPTS_TABLE
} from '../../utils/dynamodb';
import { getTestTeamIds, excludeTestTeamRows } from '../../utils/testTeams';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { success, error } from '../../utils/response';
import { enigmaScoreAfterHints, totalHintPenalty } from '../../utils/hintCost';

/**
 * Get team statistics including password attempts and comparative ranking
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Unauthorized', 401);
    }

    // Get user to find team
    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('User is not in a team', 403);
    }

    const teamId = user.teamId;

    // Get team info
    const team = await getTeamById(teamId);
    if (!team) {
      return error('Team not found', 404);
    }

    // Get all enigmas and parcours to calculate totals
    const [allEnigmas, allParcours] = await Promise.all([
      getAllEnigmas(),
      getAllParcours(),
    ]);

    // Get team progress
    const progress = await getAllTeamProgress(teamId);
    const solvedEnigmas = progress.filter((p: any) => p.solved);

    // Get parcours access/completion
    const parcoursAccess = await getAllTeamParcoursAccess(teamId);
    const completedParcours = parcoursAccess.filter((p: any) => p.completed);

    // Points acquis, indices deduits. Jusqu'ici la penalite annoncee aux equipes
    // n'etait appliquee nulle part : elle l'est desormais ici, seul endroit ou
    // un score d'equipe est reellement calcule.
    const totalPoints = solvedEnigmas.reduce((sum: number, p: any) => {
      const enigma = allEnigmas.find((e: any) => e.enigmaId === p.enigmaId);
      return sum + enigmaScoreAfterHints(enigma?.points || 0, p.hintsRequested || 0);
    }, 0);

    // Les indices pris sur une enigme non resolue ne coutent rien tant qu'elle
    // ne rapporte rien ; seule la penalite deja subie est affichee.
    const hintsPenalty = solvedEnigmas.reduce((sum: number, p: any) => {
      const enigma = allEnigmas.find((e: any) => e.enigmaId === p.enigmaId);
      return sum + totalHintPenalty(enigma?.points || 0, p.hintsRequested || 0);
    }, 0);
    const hintsRequestedCount = progress.reduce(
      (sum: number, p: any) => sum + (p.hintsRequested || 0),
      0
    );

    // Get password attempts for this team
    const teamAttempts = await getPasswordAttemptsByTeam(teamId, 10000);
    const passwordAttemptsCount = teamAttempts.length;

    // Get all password attempts from all teams for comparative stats
    const allAttemptsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: PASSWORD_ATTEMPTS_TABLE,
        ProjectionExpression: 'teamId',
      })
    );
    // Test teams play automated scenarios and would skew the percentile
    // computed for the real teams, so they are left out of the comparison
    const testTeamIds = await getTestTeamIds();
    const allAttempts = excludeTestTeamRows(allAttemptsResult.Items || [], testTeamIds);

    // Count attempts per team
    const attemptsByTeam = new Map<string, number>();
    allAttempts.forEach((attempt: any) => {
      const count = attemptsByTeam.get(attempt.teamId) || 0;
      attemptsByTeam.set(attempt.teamId, count + 1);
    });

    // Calculate ranking (percentile)
    // Lower attempts = better rank
    const teamCounts = Array.from(attemptsByTeam.values()).sort((a, b) => a - b);
    // A test team is absent from the comparison: rank it last rather than first
    const rawPosition = teamCounts.findIndex(count => count >= passwordAttemptsCount);
    const teamPosition = rawPosition === -1 ? teamCounts.length : rawPosition;
    const percentile = teamCounts.length > 0
      ? Math.round(((teamPosition + 1) / teamCounts.length) * 100)
      : 50;

    // Determine ranking message in user-friendly language
    let rankingMessage = '';
    if (percentile <= 10) {
      rankingMessage = 'Votre équipe fait partie des meilleures !';
    } else if (percentile <= 25) {
      rankingMessage = 'Votre équipe est dans le premier quart.';
    } else if (percentile <= 50) {
      rankingMessage = 'Votre équipe est dans la première moitié.';
    } else if (percentile <= 75) {
      rankingMessage = 'Votre équipe est dans la moyenne.';
    } else {
      rankingMessage = 'Votre équipe peut encore progresser !';
    }

    return success({
      teamName: team.teamName,
      memberCount: team.members?.length || 0,
      enigmasSolved: solvedEnigmas.length,
      totalEnigmas: allEnigmas.length,
      parcoursCompleted: completedParcours.length,
      totalParcours: allParcours.length,
      totalPoints,
      hintsRequestedCount,
      hintsPenalty,
      passwordAttemptsCount,
      attemptsRanking: percentile,
      attemptsRankingMessage: rankingMessage,
    });
  } catch (err: any) {
    console.error('Error getting team stats:', err);
    return error(err.message || 'Failed to get team stats');
  }
};
