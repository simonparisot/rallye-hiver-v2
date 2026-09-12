/**
 * DynamoDB access for the jeu de l'oie. Kept apart from the rules so that the
 * rules stay testable without AWS, and apart from utils/dynamodb.ts so that the
 * experiment can be removed in one piece.
 */

import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb } from '../../utils/dynamodb';
import { OieBoardConfig, OieEvent, OieEventType, OieSquare, OieTeamState } from '../../types/oie';
import { emptySquare, initialTeamState, squareType } from './rules';

export const OIE_BOARD_TABLE = process.env.OIE_BOARD_TABLE || '';
export const OIE_TEAM_STATE_TABLE = process.env.OIE_TEAM_STATE_TABLE || '';
export const OIE_EVENTS_TABLE = process.env.OIE_EVENTS_TABLE || '';

/** A single shared board, so a single partition key value everywhere. */
export const BOARD_ID = 'default';

/** Quota applied until an admin sets one. */
export const DEFAULT_ROLLS_PER_DAY = 1;

/**
 * Removes the keys whose value is undefined.
 *
 * The shared document client is not configured with removeUndefinedValues, and
 * refuses to write such a value. Several fields here are legitimately absent:
 * a square without a question, a team that has not arrived yet.
 */
function sansUndefined<T extends Record<string, any>>(item: T): T {
  const clean: Record<string, any> = {};
  Object.entries(item).forEach(([key, value]) => {
    if (value !== undefined) clean[key] = value;
  });
  return clean as T;
}

/** Raised when a conditional write loses a race against a concurrent click. */
export class OieConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OieConflictError';
  }
}

// ==================== BOARD ====================

/** Board configuration, with an empty board as a fallback. */
export async function getBoard(): Promise<OieBoardConfig> {
  const result = await dynamoDb.send(
    new GetCommand({ TableName: OIE_BOARD_TABLE, Key: { boardId: BOARD_ID } })
  );

  const stored = result.Item as OieBoardConfig | undefined;

  if (!stored) {
    return {
      boardId: BOARD_ID,
      squares: buildEmptySquares(),
      rollsPerDay: DEFAULT_ROLLS_PER_DAY,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ...stored,
    // A board saved with holes must still answer for all 64 squares.
    squares: normalizeSquares(stored.squares || []),
    rollsPerDay: stored.rollsPerDay || DEFAULT_ROLLS_PER_DAY,
  };
}

/** The 64 squares, each at its index, types recomputed from the numbers. */
export function normalizeSquares(squares: OieSquare[]): OieSquare[] {
  const byNumber = new Map<number, OieSquare>();
  squares.forEach((square) => {
    if (typeof square?.squareNumber === 'number') {
      byNumber.set(square.squareNumber, square);
    }
  });

  return buildEmptySquares().map((fallback) => {
    const stored = byNumber.get(fallback.squareNumber);
    if (!stored) return fallback;

    // Les champs absents sont omis plutot que poses a undefined : le client
    // DynamoDB refuse d'ecrire une valeur undefined, et une case sans question
    // est le cas normal (case 0, case 63, cases oie).
    return {
      squareNumber: fallback.squareNumber,
      // The type is never taken from the payload: it belongs to the rules.
      type: fallback.type,
      ...(stored.question ? { question: stored.question } : {}),
      acceptedAnswers: Array.isArray(stored.acceptedAnswers) ? stored.acceptedAnswers : [],
      ...(stored.hint ? { hint: stored.hint } : {}),
      ...(stored.flavor ? { flavor: stored.flavor } : {}),
    };
  });
}

function buildEmptySquares(): OieSquare[] {
  const squares: OieSquare[] = [];
  for (let squareNumber = 0; squareNumber <= 63; squareNumber += 1) {
    squares.push({ squareNumber, type: squareType(squareNumber), acceptedAnswers: [] });
  }
  return squares;
}

/** Replaces the whole board configuration. */
export async function saveBoard(
  squares: OieSquare[],
  rollsPerDay: number,
  enigmaId?: string,
  updatedBy?: string
): Promise<OieBoardConfig> {
  const board: OieBoardConfig = {
    boardId: BOARD_ID,
    squares: normalizeSquares(squares),
    rollsPerDay,
    // Meme raison que dans normalizeSquares : jamais de undefined a l'ecriture.
    ...(enigmaId ? { enigmaId } : {}),
    updatedAt: new Date().toISOString(),
    ...(updatedBy ? { updatedBy } : {}),
  };

  await dynamoDb.send(new PutCommand({ TableName: OIE_BOARD_TABLE, Item: board }));
  return board;
}

// ==================== TEAM STATE ====================

/** State of a team, created on the fly the first time it opens the board. */
export async function getTeamState(
  teamId: string,
  today: string,
  now: string
): Promise<OieTeamState> {
  const result = await dynamoDb.send(
    new GetCommand({ TableName: OIE_TEAM_STATE_TABLE, Key: { teamId } })
  );

  const stored = result.Item as OieTeamState | undefined;
  if (stored) {
    return { ...stored, hintedSquares: stored.hintedSquares || [] };
  }

  return initialTeamState(teamId, today, now);
}

/** Every team state, for the shared board and for the admin table. */
export async function getAllTeamStates(): Promise<OieTeamState[]> {
  const states: OieTeamState[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result: any = await dynamoDb.send(
      new ScanCommand({ TableName: OIE_TEAM_STATE_TABLE, ExclusiveStartKey: lastKey })
    );
    (result.Items || []).forEach((item: OieTeamState) => states.push(item));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return states;
}

/**
 * Writes a team state only if nobody else has written it since it was read.
 *
 * Two members of the same team can click "Lancer les des" at the same instant;
 * without this condition both rolls would be counted and the team would move
 * twice for one quota. The version carried by the item is the guard.
 */
export async function putTeamState(next: OieTeamState, expectedVersion: number): Promise<OieTeamState> {
  const item: OieTeamState = sansUndefined({ ...next, version: expectedVersion + 1 });

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: OIE_TEAM_STATE_TABLE,
        Item: item,
        ConditionExpression:
          expectedVersion === 0
            ? 'attribute_not_exists(teamId) OR version = :expected'
            : 'version = :expected',
        ExpressionAttributeValues: { ':expected': expectedVersion },
      })
    );
  } catch (err: any) {
    if (err?.name === 'ConditionalCheckFailedException') {
      throw new OieConflictError(
        'Votre equipe vient de jouer depuis un autre appareil. Rechargez le plateau.'
      );
    }
    throw err;
  }

  return item;
}

/**
 * Releases a team from the puits or from the prison.
 * Conditional on the team still being held, so that two teams landing at the
 * same time cannot free someone twice or free the newcomer.
 */
export async function releaseTeam(
  teamId: string,
  field: 'inPuits' | 'inPrison',
  today: string,
  now: string
): Promise<boolean> {
  try {
    await dynamoDb.send(
      new UpdateCommand({
        TableName: OIE_TEAM_STATE_TABLE,
        Key: { teamId },
        UpdateExpression:
          'SET #field = :false, nextRollAllowedDay = :today, updatedAt = :now, version = version + :one',
        ConditionExpression: '#field = :true',
        ExpressionAttributeNames: { '#field': field },
        ExpressionAttributeValues: {
          ':false': false,
          ':true': true,
          ':today': today,
          ':now': now,
          ':one': 1,
        },
      })
    );
    return true;
  } catch (err: any) {
    if (err?.name === 'ConditionalCheckFailedException') {
      return false; // deja libere par quelqu'un d'autre
    }
    throw err;
  }
}

/** Teams currently held in the puits or in the prison. */
export async function getHeldTeams(field: 'inPuits' | 'inPrison'): Promise<OieTeamState[]> {
  const states = await getAllTeamStates();
  return states.filter((state) => (state as any)[field] === true);
}

// ==================== EVENTS ====================

/** Appends one line to the board journal. */
export async function logEvent(input: {
  type: OieEventType;
  teamId: string;
  teamName: string;
  userId?: string;
  message: string;
  detail?: Record<string, any>;
  occurredAt?: string;
}): Promise<OieEvent> {
  const occurredAt = input.occurredAt || new Date().toISOString();
  const eventId = uuidv4();

  const event: OieEvent = {
    boardId: BOARD_ID,
    eventKey: `${occurredAt}#${eventId}`,
    eventId,
    type: input.type,
    teamId: input.teamId,
    teamName: input.teamName,
    userId: input.userId,
    occurredAt,
    message: input.message,
    detail: input.detail,
  };

  await dynamoDb.send(new PutCommand({ TableName: OIE_EVENTS_TABLE, Item: sansUndefined(event) }));
  return event;
}

/** Most recent events, newest first. */
export async function getRecentEvents(limit: number = 30): Promise<OieEvent[]> {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: OIE_EVENTS_TABLE,
      KeyConditionExpression: 'boardId = :boardId',
      ExpressionAttributeValues: { ':boardId': BOARD_ID },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items || []) as OieEvent[];
}

/** Empty square helper re-exported so handlers need a single import. */
export { emptySquare };
