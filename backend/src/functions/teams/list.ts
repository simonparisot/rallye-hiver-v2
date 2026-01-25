import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAllTeams } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('List teams event:', JSON.stringify(event, null, 2));

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '200');
    const nextToken = event.queryStringParameters?.nextToken;

    let lastKey;
    if (nextToken) {
      try {
        lastKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
      } catch (e) {
        return errorResponse('Invalid nextToken', 400);
      }
    }

    const result = await getAllTeams(limit, lastKey);

    const teams = result.items.map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
      memberCount: team.members?.length || 0,
      hasPaid: team.hasPaid,
    }));

    const response: any = { teams };

    if (result.lastKey) {
      response.nextToken = Buffer.from(JSON.stringify(result.lastKey)).toString('base64');
    }

    return successResponse(response);
  } catch (error: any) {
    console.error('List teams error:', error);
    return errorResponse(error.message || 'Failed to list teams', 500);
  }
};
