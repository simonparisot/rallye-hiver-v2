import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { dynamoDb, PASSWORD_ATTEMPTS_TABLE } from '../../../utils/dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

/**
 * GET /admin/stats/password-attempts-timeline
 *
 * Highly optimized endpoint for password attempts timeline chart
 * Returns daily counts of password attempts (correct and incorrect) over the last 30 days
 *
 * Performance: Single DynamoDB Scan with FilterExpression for time range
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Calculate time range: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoffTimestamp = thirtyDaysAgo.toISOString();

    // Fetch all password attempts from the last 30 days
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: PASSWORD_ATTEMPTS_TABLE,
        FilterExpression: 'attemptedAt >= :cutoff',
        ExpressionAttributeValues: {
          ':cutoff': cutoffTimestamp,
        },
      })
    );

    const attempts = result.Items || [];

    // Group attempts by day
    // Map structure: "YYYY-MM-DD" -> { correct: number, incorrect: number, total: number }
    const dailyBuckets = new Map<string, { correct: number; incorrect: number; total: number }>();

    // Initialize all day buckets for the last 30 days (even if no data)
    for (let i = 0; i < 30; i++) {
      const bucketTime = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const bucketKey = formatDayBucket(bucketTime);
      dailyBuckets.set(bucketKey, { correct: 0, incorrect: 0, total: 0 });
    }

    // Count attempts per day
    attempts.forEach((attempt: any) => {
      const attemptTime = new Date(attempt.attemptedAt);
      const bucketKey = formatDayBucket(attemptTime);

      // Get or initialize bucket
      if (!dailyBuckets.has(bucketKey)) {
        dailyBuckets.set(bucketKey, { correct: 0, incorrect: 0, total: 0 });
      }

      const bucket = dailyBuckets.get(bucketKey)!;

      if (attempt.success) {
        bucket.correct++;
      } else {
        bucket.incorrect++;
      }
      bucket.total++;
    });

    // Convert to sorted array (oldest to newest)
    const timeline = Array.from(dailyBuckets.entries())
      .map(([day, counts]) => ({
        day,
        timestamp: new Date(day + 'T00:00:00.000Z').toISOString(),
        correctAttempts: counts.correct,
        incorrectAttempts: counts.incorrect,
        totalAttempts: counts.total,
        successRate: counts.total > 0 ? Math.round((counts.correct / counts.total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Calculate summary stats
    const totalCorrect = timeline.reduce((sum, d) => sum + d.correctAttempts, 0);
    const totalIncorrect = timeline.reduce((sum, d) => sum + d.incorrectAttempts, 0);
    const totalAttempts = timeline.reduce((sum, d) => sum + d.totalAttempts, 0);
    const successRate = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

    return success({
      timeline,
      summary: {
        totalAttempts,
        correctAttempts: totalCorrect,
        incorrectAttempts: totalIncorrect,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimals
        periodStart: thirtyDaysAgo.toISOString(),
        periodEnd: now.toISOString(),
        daysIncluded: timeline.length,
      },
    });
  } catch (err: any) {
    console.error('Error fetching password attempts timeline:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to fetch password attempts timeline');
  }
};

/**
 * Format a date to day bucket key: "YYYY-MM-DD"
 * Example: "2025-12-23"
 */
function formatDayBucket(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
