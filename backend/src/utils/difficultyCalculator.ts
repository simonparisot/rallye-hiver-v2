import { dynamoDb, PASSWORD_ATTEMPTS_TABLE, TEAMS_TABLE, TEAM_ENIGMA_PROGRESS_TABLE, ENIGMAS_TABLE } from './dynamodb';
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { isTestTeam, excludeTestTeams, excludeTestTeamRows } from './testTeams';

/**
 * Difficulty calculation configuration (updated algorithm)
 */
const COEFFICIENTS = {
  alpha: 0.3,  // Search effort (Intensité de recherche)
  beta: 0.5,   // Failure rate among active teams (Taux d'échec des équipes actives)
  gamma: 0.2,  // Resolution time from first attempt (Temps depuis première tentative)
};

const RALLY_DURATION_DAYS = 90; // Still used as reference for normalization

export interface EnigmaDifficultyData {
  enigmaId: string;
  enigmaNumber: number;
  title: string;
  difficulty: number | null;
  metrics: {
    totalAttempts: number;
    resolutions: number;
    activeTeams: number;
    totalTeams: number;
    avgResolutionTimeDays: number | null;
    intensityScore: number;
    failureRateScore: number;
    timeScore: number;
  };
  lastCalculated: string;
}

/**
 * Calculate difficulty score for all enigmas based on observed team behavior
 *
 * Updated algorithm (2024-12-24):
 * - I (Intensity): log₂(attempts / resolutions) - measures search effort
 * - E (Failure rate): proportion of ACTIVE teams that haven't solved (not all teams)
 * - T (Time): average time from first attempt to resolution (not from rally start)
 *
 * Difficulty = (α × I) + (β × E) + (γ × T)
 * α=0.3, β=0.5, γ=0.2
 */
export async function calculateAllEnigmaDifficulties(): Promise<EnigmaDifficultyData[]> {
  // Fetch all necessary data in parallel
  const [attemptsResult, teamsResult, progressResult, enigmasResult] = await Promise.all([
    dynamoDb.send(new ScanCommand({ TableName: PASSWORD_ATTEMPTS_TABLE })),
    dynamoDb.send(new ScanCommand({ TableName: TEAMS_TABLE })),
    dynamoDb.send(new ScanCommand({ TableName: TEAM_ENIGMA_PROGRESS_TABLE })),
    dynamoDb.send(new ScanCommand({ TableName: ENIGMAS_TABLE })),
  ]);

  const teams = teamsResult.Items || [];
  const enigmas = enigmasResult.Items || [];

  // Test teams replay automated scenarios: their attempts and resolutions do not
  // reflect how real players behave and would distort every metric below.
  // Filtering here (and not in the handlers) covers both the admin and the
  // participant endpoints, which share the difficulty cache fed by this function.
  const testTeamIds = new Set<string>(
    teams.filter((team: any) => isTestTeam(team)).map((team: any) => team.teamId)
  );

  const attempts = excludeTestTeamRows(attemptsResult.Items || [], testTeamIds);
  const progressRecords = excludeTestTeamRows(progressResult.Items || [], testTeamIds);

  const totalTeams = excludeTestTeams(teams).length;

  // Build enigma info map for correct titles
  const enigmaInfoMap = new Map<string, { enigmaNumber: number; title: string }>();
  enigmas.forEach((enigma: any) => {
    enigmaInfoMap.set(enigma.enigmaId, {
      enigmaNumber: enigma.enigmaNumber || 0,
      title: enigma.title || 'Unknown',
    });
  });

  // Group data by enigma
  const enigmaMap = new Map<string, {
    enigmaNumber: number;
    title: string;
    attempts: any[];
    solvedTeams: Set<string>;
    activeTeams: Set<string>;
    resolutionTimes: number[]; // in milliseconds
  }>();

  // Process all password attempts
  attempts.forEach((attempt: any) => {
    const { enigmaId, teamId, success, attemptedAt } = attempt;

    if (!enigmaMap.has(enigmaId)) {
      const info = enigmaInfoMap.get(enigmaId) || { enigmaNumber: 0, title: 'Unknown' };
      enigmaMap.set(enigmaId, {
        enigmaNumber: info.enigmaNumber,
        title: info.title,
        attempts: [],
        solvedTeams: new Set(),
        activeTeams: new Set(),
        resolutionTimes: [],
      });
    }

    const enigmaData = enigmaMap.get(enigmaId)!;
    enigmaData.attempts.push(attempt);
    enigmaData.activeTeams.add(teamId);

    if (success) {
      enigmaData.solvedTeams.add(teamId);
    }
  });

  // Calculate resolution times from progress records
  progressRecords.forEach((progress: any) => {
    if (progress.solved && progress.solvedAt) {
      const enigmaData = enigmaMap.get(progress.enigmaId);
      if (enigmaData) {
        // Find first attempt time for this team on this enigma
        const teamAttempts = enigmaData.attempts
          .filter((a: any) => a.teamId === progress.teamId)
          .sort((a: any, b: any) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime());

        if (teamAttempts.length > 0) {
          const firstAttemptTime = new Date(teamAttempts[0].attemptedAt).getTime();
          const solutionTime = new Date(progress.solvedAt).getTime();
          const resolutionTimeMs = solutionTime - firstAttemptTime;

          if (resolutionTimeMs > 0) {
            enigmaData.resolutionTimes.push(resolutionTimeMs);
          }
        }
      }
    }
  });

  // Calculate difficulty for each enigma
  const results: EnigmaDifficultyData[] = [];

  enigmaMap.forEach((data, enigmaId) => {
    const totalAttempts = data.attempts.length;
    const resolutions = data.solvedTeams.size;
    const activeTeams = data.activeTeams.size;

    // Case: No attempts at all -> difficulty = null (not calculable)
    if (totalAttempts === 0) {
      results.push({
        enigmaId,
        enigmaNumber: data.enigmaNumber,
        title: data.title,
        difficulty: null,
        metrics: {
          totalAttempts: 0,
          resolutions: 0,
          activeTeams: 0,
          totalTeams,
          avgResolutionTimeDays: null,
          intensityScore: 0,
          failureRateScore: 0,
          timeScore: 0,
        },
        lastCalculated: new Date().toISOString(),
      });
      return;
    }

    // Calculate metrics
    let intensityScore: number;
    let timeScore: number;

    // I (Intensity) = log₂(attempts / resolutions)
    if (resolutions === 0) {
      intensityScore = 10;
    } else {
      const ratio = totalAttempts / resolutions;
      intensityScore = Math.min(10, Math.max(0, Math.log2(ratio)));
    }

    // E (Failure rate) = 10 × (1 - resolutions / activeTeams)
    // Changed: now based on active teams, not total teams
    let failureRateScore: number;
    if (activeTeams === 0) {
      failureRateScore = 0;
    } else {
      failureRateScore = 10 * (1 - resolutions / activeTeams);
    }

    // T (Time) = 10 × (avgResolutionTimeDays / rallyDuration)
    // Changed: now measured from first attempt, not from rally start
    let avgResolutionTimeDays: number | null = null;
    if (resolutions === 0) {
      timeScore = 10;
    } else if (data.resolutionTimes.length > 0) {
      const avgResolutionTimeMs = data.resolutionTimes.reduce((sum, t) => sum + t, 0) / data.resolutionTimes.length;
      avgResolutionTimeDays = avgResolutionTimeMs / (1000 * 60 * 60 * 24);
      timeScore = Math.min(10, 10 * (avgResolutionTimeDays / RALLY_DURATION_DAYS));
    } else {
      // Has resolutions but no time data -> assume minimal time
      avgResolutionTimeDays = 0;
      timeScore = 0;
    }

    // Final difficulty score (A removed)
    const difficulty =
      COEFFICIENTS.alpha * intensityScore +
      COEFFICIENTS.beta * failureRateScore +
      COEFFICIENTS.gamma * timeScore;

    results.push({
      enigmaId,
      enigmaNumber: data.enigmaNumber,
      title: data.title,
      difficulty: Math.round(difficulty * 100) / 100, // Round to 2 decimals
      metrics: {
        totalAttempts,
        resolutions,
        activeTeams,
        totalTeams,
        avgResolutionTimeDays: avgResolutionTimeDays !== null ? Math.round(avgResolutionTimeDays * 100) / 100 : null,
        intensityScore: Math.round(intensityScore * 100) / 100,
        failureRateScore: Math.round(failureRateScore * 100) / 100,
        timeScore: Math.round(timeScore * 100) / 100,
      },
      lastCalculated: new Date().toISOString(),
    });
  });

  // Sort by enigmaNumber for consistent ordering
  results.sort((a, b) => a.enigmaNumber - b.enigmaNumber);

  return results;
}
