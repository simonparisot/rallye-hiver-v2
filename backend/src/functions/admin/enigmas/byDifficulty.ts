import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { dynamoDb, ENIGMA_DIFFICULTY_CACHE_TABLE } from '../../../utils/dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { calculateAllEnigmaDifficulties, EnigmaDifficultyData } from '../../../utils/difficultyCalculator';

const CACHE_KEY = 'difficulty-cache';
const CACHE_TTL_HOURS = 24;

/**
 * GET /admin/enigmas/by-difficulty
 *
 * Returns enigmas sorted by difficulty score with full metrics
 * Uses aggressive 24-hour caching to minimize recalculation overhead
 *
 * Admin endpoint: Returns complete difficulty data with detailed metrics
 *
 * Query params:
 *  - forceRefresh: "true" to bypass cache and force recalculation
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const forceRefresh = event.queryStringParameters?.forceRefresh === 'true';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = await getCachedDifficulties();

      if (cachedData) {
        // Sort by difficulty (easiest first)
        const sorted = [...cachedData].sort((a, b) => {
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
          cacheTtlHours: CACHE_TTL_HOURS,
        });
      }
    }

    // Cache miss, expired, or force refresh - recalculate
    console.log(forceRefresh ? 'Force refresh requested' : 'Cache miss or expired. Recalculating enigma difficulties...');
    const difficulties = await calculateAllEnigmaDifficulties();

    // Store in cache
    await cacheDifficulties(difficulties);

    // Sort by difficulty (easiest first)
    const sorted = [...difficulties].sort((a, b) => {
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
      cacheTtlHours: CACHE_TTL_HOURS,
    });
  } catch (err: any) {
    console.error('Error fetching enigmas by difficulty (admin):', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

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
