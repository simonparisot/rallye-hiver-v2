/**
 * Builds what a player is allowed to see of the shared board.
 *
 * Two rules govern this file: the accepted answers never leave the server, and
 * the question of a square is only sent to a team standing on it (otherwise a
 * team could read ahead by looking at where the others are).
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb, TEAMS_TABLE } from '../../utils/dynamodb';
import { isTestTeam } from '../../utils/testTeams';
import { OieBoardConfig, OieTeamState } from '../../types/oie';
import {
  daysBetween,
  findSquare,
  rollsRemaining,
  rollRefusal,
  squareHasHint,
  squareHasQuestion,
  teamStatus,
} from './rules';
import { getAllTeamStates, getRecentEvents } from './store';

/** Board as the players see it: no question, no answer, no hint. */
export function publicBoard(board: OieBoardConfig) {
  return {
    rollsPerDay: board.rollsPerDay,
    squares: board.squares.map((square) => ({
      squareNumber: square.squareNumber,
      type: square.type,
      hasQuestion: squareHasQuestion(square),
      hasHint: squareHasHint(square),
    })),
  };
}

/** My own team card: the question in wait, the quota, what blocks me. */
export function myView(
  state: OieTeamState,
  board: OieBoardConfig,
  today: string,
  teamName: string
) {
  const square = findSquare(board.squares, state.position);
  const hintAvailable = squareHasHint(square);
  const hintRequested = (state.hintedSquares || []).includes(state.position);

  return {
    teamId: state.teamId,
    teamName,
    position: state.position,
    squareType: square.type,
    flavor: square.flavor,
    status: teamStatus(state, today, board.rollsPerDay),
    questionPending: state.questionPending,
    // La question n'est envoyee que tant qu'elle est en attente : une fois
    // repondue, elle n'a plus de raison de circuler.
    question: state.questionPending ? square.question : undefined,
    hintAvailable,
    hintRequested,
    hint: hintRequested ? square.hint : undefined,
    canRoll: rollRefusal(state, today, board.rollsPerDay) === null,
    rollRefusal: rollRefusal(state, today, board.rollsPerDay),
    rollsRemainingToday: rollsRemaining(state, today, board.rollsPerDay),
    rollsPerDay: board.rollsPerDay,
    inPuits: state.inPuits,
    inPrison: state.inPrison,
    blockedDaysLeft: Math.max(0, daysBetween(today, state.nextRollAllowedDay)),
    nextRollAllowedDay: state.nextRollAllowedDay,
    totalRolls: state.totalRolls,
    wrongAnswers: state.wrongAnswers,
    overshootCount: state.overshootCount,
    finishedAt: state.finishedAt,
    finishRank: state.finishRank,
  };
}

/** Name of every team, whether or not it has started playing. */
export async function getTeamNames(): Promise<Map<string, { teamName: string; isTest: boolean }>> {
  const names = new Map<string, { teamName: string; isTest: boolean }>();
  let lastKey: Record<string, any> | undefined;

  do {
    const result: any = await dynamoDb.send(
      new ScanCommand({
        TableName: TEAMS_TABLE,
        ProjectionExpression: 'teamId, teamName, isTestTeam',
        ExclusiveStartKey: lastKey,
      })
    );
    (result.Items || []).forEach((team: any) => {
      names.set(team.teamId, { teamName: team.teamName, isTest: isTestTeam(team) });
    });
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return names;
}

/**
 * The whole shared board for one team.
 *
 * Test teams are left out of the pawns of the other teams, as everywhere else
 * in the application, but a test team always sees itself.
 */
export async function buildBoardView(
  board: OieBoardConfig,
  myState: OieTeamState,
  myTeamId: string,
  myTeamName: string,
  today: string
) {
  const [states, names, events] = await Promise.all([
    getAllTeamStates(),
    getTeamNames(),
    getRecentEvents(30),
  ]);

  // L'etat que l'appelant vient de calculer prime sur celui relu par le scan.
  const merged = states.filter((state) => state.teamId !== myTeamId).concat([myState]);

  const teams = merged
    .filter((state) => state.teamId === myTeamId || !names.get(state.teamId)?.isTest)
    .map((state) => ({
      teamId: state.teamId,
      teamName: names.get(state.teamId)?.teamName || 'Équipe inconnue',
      position: state.position,
      status: teamStatus(state, today, board.rollsPerDay),
      inPuits: state.inPuits,
      inPrison: state.inPrison,
      finishedAt: state.finishedAt,
      finishRank: state.finishRank,
      isMine: state.teamId === myTeamId,
    }))
    .sort((a, b) => b.position - a.position);

  return {
    board: publicBoard(board),
    today,
    teams,
    me: myView(myState, board, today, myTeamName),
    events: events.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      teamId: event.teamId,
      teamName: event.teamName,
      occurredAt: event.occurredAt,
      message: event.message,
    })),
  };
}
