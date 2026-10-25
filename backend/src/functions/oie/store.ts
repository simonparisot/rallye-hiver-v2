/**
 * DynamoDB access for the jeu de l'oie. Kept apart from the rules so that the
 * rules stay testable without AWS, and apart from utils/dynamodb.ts so that the
 * experiment can be removed in one piece.
 */

import { GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
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
        'Votre équipe vient de jouer depuis un autre appareil. Rechargez le plateau.'
      );
    }
    throw err;
  }

  return item;
}

/**
 * Changes another team's state, typically to dislodge it from a square.
 *
 * The state is read again and the change recomputed on every attempt, under
 * the same version condition as putTeamState: if the team plays at the very
 * same moment, its own move wins and the change is reconsidered against where
 * it now stands. `change` returns null when it no longer applies (the team has
 * left the square meanwhile), and the function then returns null too.
 */
export async function changeTeamState(
  teamId: string,
  today: string,
  now: string,
  change: (state: OieTeamState) => OieTeamState | null,
  attempts: number = 3
): Promise<{ before: OieTeamState; after: OieTeamState } | null> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const before = await getTeamState(teamId, today, now);
    const next = change(before);
    if (!next) return null;

    try {
      const after = await putTeamState(next, before.version);
      return { before, after };
    } catch (err) {
      if (!(err instanceof OieConflictError) || attempt === attempts) throw err;
    }
  }
  return null;
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

/**
 * Ce que le fil « Ce qui se passe » montre : ce qui bouge sur le plateau.
 *
 * Les reponses et les appels au souffleur restent au journal, pour l'analyse,
 * mais n'ont rien a faire dans le fil : une equipe qui se trompe cinq fois de
 * suite y poussait cinq lignes, et chassait du fil les deplacements des autres,
 * qui sont justement ce que le plateau partage doit raconter.
 */
const FEED_EVENT_TYPES: OieEventType[] = [
  'lancer',
  'deplacement',
  'case_speciale',
  'liberation',
  'arrivee',
  'reinitialisation',
];

/** Lignes lues par page, et pages lues au plus : le cout d'un GET reste borne. */
const FEED_PAGE_SIZE = 200;
const FEED_MAX_PAGES = 3;

/** Most recent board events for the shared feed, newest first. */
export async function getFeedEvents(limit: number = 100): Promise<OieEvent[]> {
  const feed: OieEvent[] = [];
  let lastKey: Record<string, any> | undefined;
  let pages = 0;

  // Le filtre est applique ici plutot que par une FilterExpression : DynamoDB
  // applique Limit avant le filtre, si bien qu'une page pleine de reponses
  // reviendrait presque vide sans rien dire.
  do {
    const result: any = await dynamoDb.send(
      new QueryCommand({
        TableName: OIE_EVENTS_TABLE,
        KeyConditionExpression: 'boardId = :boardId',
        ExpressionAttributeValues: { ':boardId': BOARD_ID },
        ScanIndexForward: false,
        Limit: FEED_PAGE_SIZE,
        ExclusiveStartKey: lastKey,
      })
    );
    ((result.Items || []) as OieEvent[]).forEach((event) => {
      if (feed.length < limit && FEED_EVENT_TYPES.includes(event.type)) feed.push(event);
    });
    lastKey = result.LastEvaluatedKey;
    pages += 1;
  } while (lastKey && feed.length < limit && pages < FEED_MAX_PAGES);

  return feed;
}

/** Empty square helper re-exported so handlers need a single import. */
export { emptySquare };
