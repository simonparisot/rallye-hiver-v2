import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.COGNITO_REGION || 'eu-west-1' });
export const dynamoDb = DynamoDBDocumentClient.from(client);

export const USERS_TABLE = process.env.USERS_TABLE || '';
export const TEAMS_TABLE = process.env.TEAMS_TABLE || '';
export const ENIGMAS_TABLE = process.env.ENIGMAS_TABLE || '';
export const PARCOURS_TABLE = process.env.PARCOURS_TABLE || '';
export const TEAM_ENIGMA_PROGRESS_TABLE = process.env.TEAM_ENIGMA_PROGRESS_TABLE || '';
export const PASSWORD_ATTEMPTS_TABLE = process.env.PASSWORD_ATTEMPTS_TABLE || '';
export const TEAM_PARCOURS_ACCESS_TABLE = process.env.TEAM_PARCOURS_ACCESS_TABLE || '';
export const GAME_STATUS_TABLE = process.env.GAME_STATUS_TABLE || '';
export const ENIGMA_DIFFICULTY_CACHE_TABLE = process.env.ENIGMA_DIFFICULTY_CACHE_TABLE || '';

export async function getUserByCognitoSub(cognitoSub: string) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'cognitoSub-index',
      KeyConditionExpression: 'cognitoSub = :sub',
      ExpressionAttributeValues: {
        ':sub': cognitoSub,
      },
    })
  );
  return result.Items?.[0];
}

export async function getUserById(userId: string) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    })
  );
  return result.Item;
}

export async function getUserByEmail(email: string) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
    })
  );
  return result.Items?.[0];
}

export async function getTeamById(teamId: string) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: TEAMS_TABLE,
      Key: { teamId },
    })
  );
  return result.Item;
}

export async function createUser(user: any) {
  await dynamoDb.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
    })
  );
  return user;
}

export async function updateUser(userId: string, updates: any) {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updates).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updates[key];
  });

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

export async function createTeam(team: any) {
  await dynamoDb.send(
    new PutCommand({
      TableName: TEAMS_TABLE,
      Item: team,
    })
  );
  return team;
}

export async function updateTeam(teamId: string, updates: any) {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updates).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updates[key];
  });

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: TEAMS_TABLE,
      Key: { teamId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

export async function getAllTeams(limit: number = 50, lastKey?: any) {
  const params: any = {
    TableName: TEAMS_TABLE,
    Limit: limit,
  };

  if (lastKey) {
    params.ExclusiveStartKey = lastKey;
  }

  const result = await dynamoDb.send(new ScanCommand(params));

  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey,
  };
}

export async function getUsersByIds(userIds: string[]) {
  if (!userIds || userIds.length === 0) return [];

  const users = await Promise.all(
    userIds.map((userId) => getUserById(userId))
  );

  return users.filter((user) => user !== undefined);
}

export async function getTeamsWithPendingRequest(userId: string) {
  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: 'contains(pendingRequests, :userId)',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    })
  );

  return result.Items || [];
}

/**
 * Normalize team name for comparison
 * - Converts to lowercase for case-insensitive comparison
 * - Trims whitespace from start and end
 * - Replaces multiple consecutive spaces with a single space
 */
function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function getTeamByName(teamName: string) {
  // Normalize the search term
  const normalizedSearchName = normalizeTeamName(teamName);

  // Get all teams (we need to scan to compare normalized names)
  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: TEAMS_TABLE,
    })
  );

  const teams = result.Items || [];

  // Find team with matching normalized name
  const matchingTeam = teams.find((team: any) => {
    const normalizedTeamName = normalizeTeamName(team.teamName);
    return normalizedTeamName === normalizedSearchName;
  });

  return matchingTeam;
}

// ==================== ENIGMA FUNCTIONS ====================

export async function createEnigma(enigma: any) {
  await dynamoDb.send(
    new PutCommand({
      TableName: ENIGMAS_TABLE,
      Item: enigma,
    })
  );
  return enigma;
}

export async function getEnigmaById(enigmaId: string) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: ENIGMAS_TABLE,
      Key: { enigmaId },
    })
  );
  return result.Item;
}

export async function getAllEnigmas() {
  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: ENIGMAS_TABLE,
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': true,
      },
    })
  );
  return result.Items || [];
}

export async function getAllEnigmasForAdmin() {
  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: ENIGMAS_TABLE,
    })
  );
  return result.Items || [];
}

export async function updateEnigma(enigmaId: string, updates: any) {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updates).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updates[key];
  });

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: ENIGMAS_TABLE,
      Key: { enigmaId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

export async function deleteEnigma(enigmaId: string) {
  await dynamoDb.send(
    new DeleteCommand({
      TableName: ENIGMAS_TABLE,
      Key: { enigmaId },
    })
  );
}

// ==================== PARCOURS FUNCTIONS ====================

export async function createParcours(parcours: any) {
  await dynamoDb.send(
    new PutCommand({
      TableName: PARCOURS_TABLE,
      Item: parcours,
    })
  );
  return parcours;
}

export async function getParcoursById(parcoursId: string) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: PARCOURS_TABLE,
      Key: { parcoursId },
    })
  );
  return result.Item;
}

export async function getAllParcours() {
  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: PARCOURS_TABLE,
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': true,
      },
    })
  );
  return result.Items || [];
}

export async function getAllParcoursForAdmin() {
  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: PARCOURS_TABLE,
    })
  );
  return result.Items || [];
}

export async function updateParcours(parcoursId: string, updates: any) {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updates).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updates[key];
  });

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: PARCOURS_TABLE,
      Key: { parcoursId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

export async function deleteParcours(parcoursId: string) {
  await dynamoDb.send(
    new DeleteCommand({
      TableName: PARCOURS_TABLE,
      Key: { parcoursId },
    })
  );
}

// ==================== TEAM ENIGMA PROGRESS FUNCTIONS ====================

export async function getTeamProgress(teamId: string, enigmaId: string) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: TEAM_ENIGMA_PROGRESS_TABLE,
      Key: { teamId, enigmaId },
    })
  );
  return result.Item;
}

export async function getAllTeamProgress(teamId: string) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: TEAM_ENIGMA_PROGRESS_TABLE,
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: {
        ':teamId': teamId,
      },
    })
  );
  return result.Items || [];
}

export async function createOrUpdateTeamProgress(teamId: string, enigmaId: string, updates: any) {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updates).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updates[key];
  });

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: TEAM_ENIGMA_PROGRESS_TABLE,
      Key: { teamId, enigmaId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

export async function getEnigmaLeaderboard(enigmaId: string) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: TEAM_ENIGMA_PROGRESS_TABLE,
      IndexName: 'enigmaId-solvedAt-index',
      KeyConditionExpression: 'enigmaId = :enigmaId',
      FilterExpression: 'solved = :solved',
      ExpressionAttributeValues: {
        ':enigmaId': enigmaId,
        ':solved': true,
      },
    })
  );
  return result.Items || [];
}

// ==================== PASSWORD ATTEMPT LOG FUNCTIONS ====================

export async function logPasswordAttempt(attempt: any) {
  await dynamoDb.send(
    new PutCommand({
      TableName: PASSWORD_ATTEMPTS_TABLE,
      Item: attempt,
    })
  );
  return attempt;
}

export async function getPasswordAttemptsByTeam(teamId: string, limit: number = 100) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: PASSWORD_ATTEMPTS_TABLE,
      IndexName: 'teamId-attemptedAt-index',
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: {
        ':teamId': teamId,
      },
      Limit: limit,
      ScanIndexForward: false, // descending order (newest first)
    })
  );
  return result.Items || [];
}

export async function getPasswordAttemptsByEnigma(enigmaId: string, limit: number = 100) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: PASSWORD_ATTEMPTS_TABLE,
      IndexName: 'enigmaId-attemptedAt-index',
      KeyConditionExpression: 'enigmaId = :enigmaId',
      ExpressionAttributeValues: {
        ':enigmaId': enigmaId,
      },
      Limit: limit,
      ScanIndexForward: false, // descending order (newest first)
    })
  );
  return result.Items || [];
}

export async function getPasswordAttemptsByTeamAndEnigma(teamId: string, enigmaId: string, limit: number = 100) {
  const teamEnigmaKey = `${teamId}#${enigmaId}`;
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: PASSWORD_ATTEMPTS_TABLE,
      IndexName: 'teamEnigma-index',
      KeyConditionExpression: 'teamEnigmaKey = :teamEnigmaKey',
      ExpressionAttributeValues: {
        ':teamEnigmaKey': teamEnigmaKey,
      },
      Limit: limit,
      ScanIndexForward: false, // descending order (newest first)
    })
  );
  return result.Items || [];
}

// ==================== TEAM PARCOURS ACCESS FUNCTIONS ====================

export async function grantParcoursAccess(access: any) {
  await dynamoDb.send(
    new PutCommand({
      TableName: TEAM_PARCOURS_ACCESS_TABLE,
      Item: access,
    })
  );
  return access;
}

export async function getTeamParcoursAccess(teamId: string, parcoursId: string) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: TEAM_PARCOURS_ACCESS_TABLE,
      Key: { teamId, parcoursId },
    })
  );
  return result.Item;
}

export async function getAllTeamParcoursAccess(teamId: string) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: TEAM_PARCOURS_ACCESS_TABLE,
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: {
        ':teamId': teamId,
      },
    })
  );
  return result.Items || [];
}

export async function updateTeamParcoursAccess(teamId: string, parcoursId: string, updates: any) {
  const setExpressions: string[] = [];
  const removeExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};
  let attrIndex = 0;

  Object.keys(updates).forEach((key) => {
    const attrName = `#attr${attrIndex}`;

    if (updates[key] === undefined) {
      // Remove the attribute if value is undefined
      removeExpressions.push(attrName);
      expressionAttributeNames[attrName] = key;
    } else {
      // Set the attribute
      const attrValue = `:val${attrIndex}`;
      setExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    }

    attrIndex++;
  });

  // Build update expression
  const updateParts: string[] = [];
  if (setExpressions.length > 0) {
    updateParts.push(`SET ${setExpressions.join(', ')}`);
  }
  if (removeExpressions.length > 0) {
    updateParts.push(`REMOVE ${removeExpressions.join(', ')}`);
  }

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: TEAM_PARCOURS_ACCESS_TABLE,
      Key: { teamId, parcoursId },
      UpdateExpression: updateParts.join(' '),
      ExpressionAttributeNames: expressionAttributeNames,
      ...(Object.keys(expressionAttributeValues).length > 0 && {
        ExpressionAttributeValues: expressionAttributeValues,
      }),
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

// ==================== GAME STATUS FUNCTIONS ====================

const GAME_ID = 'rallye-2025'; // Fixed game ID for current season

export async function getGameStatus() {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: GAME_STATUS_TABLE,
      Key: { gameId: GAME_ID },
    })
  );
  return result.Item;
}

export async function initializeGameStatus() {
  const now = new Date().toISOString();
  const gameStatus = {
    gameId: GAME_ID,
    isStarted: false,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: GAME_STATUS_TABLE,
      Item: gameStatus,
      ConditionExpression: 'attribute_not_exists(gameId)', // Only create if doesn't exist
    })
  );

  return gameStatus;
}

export async function startGame(adminUserId: string) {
  const now = new Date().toISOString();

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: GAME_STATUS_TABLE,
      Key: { gameId: GAME_ID },
      UpdateExpression: 'SET isStarted = :isStarted, startedAt = :startedAt, startedBy = :startedBy, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isStarted': true,
        ':startedAt': now,
        ':startedBy': adminUserId,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}
