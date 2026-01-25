import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error } from '../../utils/response';
import { dynamoDb, ENIGMA_DIFFICULTY_CACHE_TABLE } from '../../utils/dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { calculateAllEnigmaDifficulties, EnigmaDifficultyData } from '../../utils/difficultyCalculator';

const CACHE_KEY = 'difficulty-cache';
const CACHE_TTL_HOURS = 24;

/**
 * GET /enigmas/by-difficulty
 *
 * Returns enigmas sorted by difficulty score (hardest first)
 * Uses aggressive 24-hour caching to minimize recalculation overhead
 *
 * User endpoint: Only returns basic difficulty info without detailed metrics
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check cache first
    const cachedData = await getCachedDifficulties();

    if (cachedData) {
      // Return cached data with sanitized user-facing info
      const userFriendlyData = cachedData.map((enigma) => ({
        enigmaId: enigma.enigmaId,
        enigmaNumber: enigma.enigmaNumber,
        title: enigma.title,
        difficulty: enigma.difficulty,
        lastCalculated: enigma.lastCalculated,
      }));

      // Sort by difficulty (easiest first), then by enigmaNumber
      const sorted = userFriendlyData.sort((a, b) => {
        if (a.difficulty === null && b.difficulty === null) return a.enigmaNumber - b.enigmaNumber;
        if (a.difficulty === null) return 1; // nulls go to end
        if (b.difficulty === null) return -1;
        if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty; // ascending
        return a.enigmaNumber - b.enigmaNumber; // tie-breaker
      });

      return success({
        enigmas: sorted,
        fromCache: true,
        calculatedAt: cachedData[0]?.lastCalculated || new Date().toISOString(),
      });
    }

    // Cache miss or expired - recalculate
    console.log('Cache miss or expired. Recalculating enigma difficulties...');
    const difficulties = await calculateAllEnigmaDifficulties();

    // Store in cache
    await cacheDifficulties(difficulties);

    // Return user-friendly data
    const userFriendlyData = difficulties.map((enigma) => ({
      enigmaId: enigma.enigmaId,
      enigmaNumber: enigma.enigmaNumber,
      title: enigma.title,
      difficulty: enigma.difficulty,
      lastCalculated: enigma.lastCalculated,
    }));

    // Sort by difficulty (easiest first)
    const sorted = userFriendlyData.sort((a, b) => {
      if (a.difficulty === null && b.difficulty === null) return a.enigmaNumber - b.enigmaNumber;
      if (a.difficulty === null) return 1;
      if (b.difficulty === null) return -1;
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
      return a.enigmaNumber - b.enigmaNumber;
    });

    return success({
      enigmas: sorted,
      fromCache: false,
      calculatedAt: difficulties[0]?.lastCalculated || new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error fetching enigmas by difficulty:', err);
    return error(err.message || 'Failed to fetch enigmas by difficulty');
  }
};

/**
 * Get cached difficulties if available and not expired
 */
async function getCachedDifficulties(): Promise<EnigmaDifficultyData[] | null> {
  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: ENIGMA_DIFFICULTY_CACHE_TABLE,
        Key: { cacheKey: CACHE_KEY },
      })
    );

    if (!result.Item) {
      return null;
    }

    const { data, cachedAt } = result.Item;
    const cacheAge = Date.now() - new Date(cachedAt).getTime();
    const cacheAgeHours = cacheAge / (1000 * 60 * 60);

    if (cacheAgeHours > CACHE_TTL_HOURS) {
      console.log(`Cache expired: ${cacheAgeHours.toFixed(2)}h old (TTL: ${CACHE_TTL_HOURS}h)`);
      return null;
    }

    console.log(`Cache hit: ${cacheAgeHours.toFixed(2)}h old`);
    return data as EnigmaDifficultyData[];
  } catch (err) {
    console.error('Error reading cache:', err);
    return null;
  }
}

/**
 * Cache difficulty data for 24 hours
 */
async function cacheDifficulties(data: EnigmaDifficultyData[]): Promise<void> {
  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: ENIGMA_DIFFICULTY_CACHE_TABLE,
        Item: {
          cacheKey: CACHE_KEY,
          data,
          cachedAt: new Date().toISOString(),
          ttlHours: CACHE_TTL_HOURS,
        },
      })
    );
    console.log('Difficulties cached successfully');
  } catch (err) {
    console.error('Error caching difficulties:', err);
    // Don't throw - caching failure shouldn't fail the request
  }
}
