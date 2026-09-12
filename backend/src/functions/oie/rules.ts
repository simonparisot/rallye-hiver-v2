/**
 * Pure rules of the jeu de l'oie: no AWS, no clock of its own, no randomness
 * unless one is handed in. Everything here is unit testable, and every handler
 * delegates to it so that the rules exist in exactly one place.
 */

import {
  OieMoveEffect,
  OieMoveResult,
  OieSquare,
  OieSquareType,
  OieTeamState,
  OieTeamStatus,
} from '../../types/oie';

/** Last square of the board; it must be reached exactly. */
export const FINISH_SQUARE = 63;

/** L'acteur sur son oie: every 9 squares, one plays again. */
export const OIE_SQUARES = [9, 18, 27, 36, 45, 54];

/** Le souffleur: these questions come with a hint on request. */
export const SOUFFLEUR_SQUARES = [14, 39, 50, 60];

export const LOGE_SQUARE = 19;
export const PUITS_SQUARE = 31;
export const PRISON_SQUARE = 52;
export const MORT_SQUARE = 58;

/** Days of roll forfeited by the loge and by the prison. */
export const LOGE_SKIPPED_DAYS = 1;
export const PRISON_SKIPPED_DAYS = 2;

/**
 * At the third failure to land exactly on 63, "le metteur en scene" places the
 * team on the finish square. The count includes the failure being resolved.
 */
export const MAX_OVERSHOOTS = 3;

/** Guards the oie chain: a roll can never resolve for ever. */
const MAX_MOVE_ITERATIONS = 32;

/** Type of a square, derived from its number alone. */
export function squareType(squareNumber: number): OieSquareType {
  if (squareNumber === 0) return 'depart';
  if (squareNumber === FINISH_SQUARE) return 'arrivee';
  if (OIE_SQUARES.includes(squareNumber)) return 'oie';
  if (squareNumber === LOGE_SQUARE) return 'loge';
  if (squareNumber === PUITS_SQUARE) return 'puits';
  if (squareNumber === PRISON_SQUARE) return 'prison';
  if (squareNumber === MORT_SQUARE) return 'mort';
  if (SOUFFLEUR_SQUARES.includes(squareNumber)) return 'souffleur';
  return 'normale';
}

// ==================== DATES (Europe/Paris) ====================

/**
 * The playing day changes at midnight in Paris, not in UTC: a roll made at
 * 00h30 in Paris in January belongs to the new day even though UTC still shows
 * the previous one. Intl gives the right answer through daylight saving too.
 */
const PARIS_DAY_FORMAT = new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Playing day of an instant, as YYYY-MM-DD in Europe/Paris. */
export function parisDay(date: Date): string {
  const parts = PARIS_DAY_FORMAT.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Adds a number of days to a YYYY-MM-DD playing day. */
export function addDays(day: string, count: number): string {
  const [year, month, date] = day.split('-').map((value) => parseInt(value, 10));
  // Midday UTC keeps the arithmetic away from any daylight saving edge.
  const shifted = new Date(Date.UTC(year, month - 1, date + count, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(
    shifted.getUTCDate()
  ).padStart(2, '0')}`;
}

/** Whole days between two playing days (negative if `to` is in the past). */
export function daysBetween(from: string, to: string): number {
  const toUtc = (day: string) => {
    const [year, month, date] = day.split('-').map((value) => parseInt(value, 10));
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

// ==================== ANSWERS ====================

/**
 * Same normalisation as the enigma passwords (see progress/submitAttempt.ts):
 * lower case, no accent, no ligature, no whitespace, no punctuation. A player
 * who writes "Moliere !" must not be refused for "Molière".
 */
export function normalizeAnswer(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** True when the answer matches any of the accepted answers of the square. */
export function isAnswerCorrect(answer: string, acceptedAnswers: string[]): boolean {
  const normalized = normalizeAnswer(answer);
  if (normalized.length === 0) return false;
  return acceptedAnswers.some((accepted) => normalizeAnswer(accepted) === normalized);
}

// ==================== DICE ====================

/** Two six sided dice. The generator is injected so tests stay deterministic. */
export function rollDice(random: () => number = Math.random): [number, number] {
  return [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
}

// ==================== MOVE ====================

/**
 * Resolves a roll from a position, chaining the oie squares and the rebound on
 * the finish square. Nothing here touches the other teams: the puits and the
 * prison are only reported, the handler decides who gets released.
 *
 * @param startPosition where the team stands before the roll
 * @param total sum of the two dice
 * @param overshootCount failures to land exactly on 63 so far
 */
export function resolveMove(
  startPosition: number,
  total: number,
  overshootCount: number
): OieMoveResult {
  const effects: OieMoveEffect[] = [];
  let position = startPosition;
  let step = total;
  let overshoots = overshootCount;
  let finished = false;
  let inPuits = false;
  let inPrison = false;
  let skippedDays = 0;

  for (let iteration = 0; iteration < MAX_MOVE_ITERATIONS; iteration += 1) {
    const target = position + step;

    if (target > FINISH_SQUARE) {
      overshoots += 1;

      if (overshoots >= MAX_OVERSHOOTS) {
        // Le metteur en scene met fin a l'agonie de la fin de partie.
        effects.push({ kind: 'metteur_en_scene', from: position, to: FINISH_SQUARE });
        position = FINISH_SQUARE;
        finished = true;
        break;
      }

      const rebound = 2 * FINISH_SQUARE - target;
      effects.push({
        kind: 'rebond',
        from: position,
        to: rebound,
        depassement: target - FINISH_SQUARE,
      });
      position = rebound;
    } else {
      effects.push({ kind: 'avance', from: position, to: target });
      position = target;
    }

    const type = squareType(position);

    if (type === 'arrivee') {
      effects.push({ kind: 'arrivee', at: position });
      finished = true;
      break;
    }

    if (type === 'oie') {
      // On rejoue du meme total, tout de suite, sans consommer de lancer et
      // sans question sur la case oie elle meme.
      effects.push({ kind: 'oie', at: position, total });
      step = total;
      continue;
    }

    if (type === 'mort') {
      effects.push({ kind: 'mort', from: position, to: 0 });
      position = 0;
      break;
    }

    if (type === 'puits') {
      effects.push({ kind: 'puits', at: position });
      inPuits = true;
      break;
    }

    if (type === 'prison') {
      effects.push({ kind: 'prison', at: position });
      inPrison = true;
      skippedDays = PRISON_SKIPPED_DAYS;
      break;
    }

    if (type === 'loge') {
      effects.push({ kind: 'loge', at: position });
      skippedDays = LOGE_SKIPPED_DAYS;
      break;
    }

    if (type === 'souffleur') {
      effects.push({ kind: 'souffleur', at: position });
      break;
    }

    break;
  }

  return { position, finished, overshootCount: overshoots, inPuits, inPrison, skippedDays, effects };
}

// ==================== TEAM STATE ====================

/** State of a team that has never played. */
export function initialTeamState(teamId: string, today: string, now: string): OieTeamState {
  return {
    teamId,
    position: 0,
    questionPending: false,
    inPuits: false,
    inPrison: false,
    nextRollAllowedDay: today,
    rollsUsedToday: 0,
    rollsDay: today,
    totalRolls: 0,
    wrongAnswers: 0,
    hintedSquares: [],
    overshootCount: 0,
    createdAt: now,
    updatedAt: now,
    version: 0,
  };
}

/** Rolls already used today, zero as soon as the playing day has changed. */
export function rollsUsedOn(state: OieTeamState, today: string): number {
  return state.rollsDay === today ? state.rollsUsedToday : 0;
}

/** Rolls the team may still use today. */
export function rollsRemaining(state: OieTeamState, today: string, rollsPerDay: number): number {
  return Math.max(0, rollsPerDay - rollsUsedOn(state, today));
}

/** Why the team cannot roll right now, or null when it can. */
export function rollRefusal(
  state: OieTeamState,
  today: string,
  rollsPerDay: number
): string | null {
  if (state.finishedAt) {
    return 'Votre equipe est deja arrivee en case 63.';
  }
  if (state.questionPending) {
    return 'Repondez d\'abord a la question de votre case.';
  }
  if (state.inPuits) {
    return 'Vous etes dans le puits : attendez qu\'une autre equipe y tombe pour vous repecher.';
  }
  if (daysBetween(today, state.nextRollAllowedDay) > 0) {
    const remaining = daysBetween(today, state.nextRollAllowedDay);
    return state.inPrison
      ? `Vous etes en prison : encore ${remaining} jour(s) sans lancer.`
      : `Vous passez un tour : encore ${remaining} jour(s) sans lancer.`;
  }
  if (rollsRemaining(state, today, rollsPerDay) <= 0) {
    return 'Vous avez utilise tous vos lancers du jour. Revenez demain.';
  }
  return null;
}

/** True when the team may roll right now. */
export function canRoll(state: OieTeamState, today: string, rollsPerDay: number): boolean {
  return rollRefusal(state, today, rollsPerDay) === null;
}

/** Status name for the interface. */
export function teamStatus(
  state: OieTeamState,
  today: string,
  rollsPerDay: number
): OieTeamStatus {
  if (state.finishedAt) return 'arrivee';
  if (state.inPuits) return 'dans_le_puits';
  if (state.questionPending) return 'question_en_attente';
  if (daysBetween(today, state.nextRollAllowedDay) > 0) return 'tour_passe';
  if (rollsRemaining(state, today, rollsPerDay) <= 0) return 'quota_epuise';
  return 'peut_lancer';
}

// ==================== BOARD ====================

/** Default square, used when the admin has not configured this number yet. */
export function emptySquare(squareNumber: number): OieSquare {
  return { squareNumber, type: squareType(squareNumber), acceptedAnswers: [] };
}

/** Square of a board by number, never undefined. */
export function findSquare(squares: OieSquare[], squareNumber: number): OieSquare {
  return squares.find((square) => square.squareNumber === squareNumber) || emptySquare(squareNumber);
}

/**
 * A question only awaits an answer when the square actually carries one.
 * Square 0 and square 63 have none, and an unconfigured square must not block
 * a team for ever.
 */
export function squareHasQuestion(square: OieSquare): boolean {
  return !!square.question && square.acceptedAnswers.length > 0;
}

/** Does this square offer a souffleur hint? */
export function squareHasHint(square: OieSquare): boolean {
  return square.type === 'souffleur' && !!square.hint;
}
