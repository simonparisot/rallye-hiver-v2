import { APIGatewayProxyEvent } from 'aws-lambda';

export function getUserIdFromEvent(event: APIGatewayProxyEvent): string | undefined {
  // REST API format
  return event.requestContext?.authorizer?.userId;
}
