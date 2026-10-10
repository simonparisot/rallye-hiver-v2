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

/** L'acteur sur son oie: every 9 squares, one rolls the dice again. */
export const OIE_SQUARES = [9, 18, 27, 36, 45, 54];

/** Le souffleur: these questions come with a hint on request. */
export const SOUFFLEUR_SQUARES = [14, 39, 50, 60];

export const LOGE_SQUARE = 19;
export const PUITS_SQUARE = 31;
export const PRISON_SQUARE = 52;
export const MORT_SQUARE = 58;

/**
 * Days of roll forfeited by the loge, the prison and the puits.
 *
 * The puits used to hold a team until another one fell on square 31. With few
 * teams playing, that is not a setback, it is an elimination: nothing in the
 * team's own hands could ever free it. It now works like the prison, three
 * days instead of two, and the rescue by another team remains as a way out
 * sooner rather than as the only way out.
 */
export const LOGE_SKIPPED_DAYS = 1;
export const PRISON_SKIPPED_DAYS = 2;
export const PUITS_SKIPPED_DAYS = 3;

/**
 * At the third failure to land exactly on 63, "le metteur en scene" places the
 * team on the finish square. The count includes the failure being resolved.
 */
export const MAX_OVERSHOOTS = 3;

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
 * Resolves one roll from one position: the move, the rebound on the finish
 * square, then the rule of the square landed on. Exactly one roll, never a
 * chain.
 *
 * L'acteur sur son oie grants another roll rather than replaying the same
 * total. That is what the organisers expect from "rejouer", and it also closes
 * a hole the traditional rule carries: with the same total replayed, a nine
 * from square 0 walks the six oies, 9, 18, 27, 36, 45, 54, and wins the game
 * on the first throw, once in nine games. The classic game patches that with
 * two arbitrary destinations (a first nine of 6-3 goes to 26, of 5-4 to 53);
 * rolling again makes the patch pointless, so it is gone, and with it the
 * unexplainable jump to square 26.
 *
 * Nothing here touches the other teams: the puits and the prison are only
 * reported, the handler decides who gets released.
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
  const result: OieMoveResult = {
    position: startPosition,
    finished: false,
    overshootCount,
    inPuits: false,
    inPrison: false,
    skippedDays: 0,
    bonusRoll: false,
    effects,
  };

  const target = startPosition + total;

  if (target > FINISH_SQUARE) {
    result.overshootCount += 1;

    if (result.overshootCount >= MAX_OVERSHOOTS) {
      // Le metteur en scene met fin a l'agonie de la fin de partie.
      effects.push({ kind: 'metteur_en_scene', from: startPosition, to: FINISH_SQUARE });
      result.position = FINISH_SQUARE;
      result.finished = true;
      return result;
    }

    result.position = 2 * FINISH_SQUARE - target;
    effects.push({
      kind: 'rebond',
      from: startPosition,
      to: result.position,
      depassement: target - FINISH_SQUARE,
    });
  } else {
    result.position = target;
    effects.push({ kind: 'avance', from: startPosition, to: result.position });
  }

  // La regle de la case atteinte s'applique aussi bien a une avance qu'a un
  // rebond : reculer sur le puits y fait tomber tout autant.
  switch (squareType(result.position)) {
    case 'arrivee':
      effects.push({ kind: 'arrivee', at: result.position });
      result.finished = true;
      break;

    case 'oie':
      // On relance les des, sans consommer de lancer du quota et sans question
      // sur la case oie elle meme.
      effects.push({ kind: 'oie', at: result.position });
      result.bonusRoll = true;
      break;

    case 'mort':
      effects.push({ kind: 'mort', from: result.position, to: 0 });
      result.position = 0;
      break;

    case 'puits':
      effects.push({ kind: 'puits', at: result.position });
      result.inPuits = true;
      result.skippedDays = PUITS_SKIPPED_DAYS;
      break;

    case 'prison':
      effects.push({ kind: 'prison', at: result.position });
      result.inPrison = true;
      result.skippedDays = PRISON_SKIPPED_DAYS;
      break;

    case 'loge':
      effects.push({ kind: 'loge', at: result.position });
      result.skippedDays = LOGE_SKIPPED_DAYS;
      break;

    case 'souffleur':
      effects.push({ kind: 'souffleur', at: result.position });
      break;

    default:
      break;
  }

  return result;
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
    bonusRolls: 0,
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

/** Rolls owed by the oie squares, never negative whatever is stored. */
export function bonusRolls(state: OieTeamState): number {
  return Math.max(0, state.bonusRolls || 0);
}

/** Why the team cannot roll right now, or null when it can. */
export function rollRefusal(
  state: OieTeamState,
  today: string,
  rollsPerDay: number
): string | null {
  if (state.finishedAt) {
    return 'Votre équipe a déjà remporté le jeu de l\'oie.';
  }
  if (state.questionPending) {
    return state.position === FINISH_SQUARE
      ? 'Répondez d\'abord à la question finale.'
      : 'Répondez d\'abord à la question de votre case.';
  }
  // Le lancer dû par une oie passe avant tout le reste : il est déjà gagné, ni
  // le quota du jour ni une pénalité ne peuvent le reprendre. Une équipe ne
  // peut d'ailleurs pas être sur une oie et punie en même temps, puisque c'est
  // le lancer qui vient de l'amener sur l'oie qui le lui doit.
  if (bonusRolls(state) > 0) {
    return null;
  }
  if (daysBetween(today, state.nextRollAllowedDay) > 0) {
    const remaining = daysBetween(today, state.nextRollAllowedDay);
    if (state.inPuits) {
      return `Vous êtes au fond du puits : encore ${remaining} jour(s) sans lancer, à moins qu'une autre équipe n'y tombe et vous repêche.`;
    }
    return state.inPrison
      ? `Vous êtes en prison : encore ${remaining} jour(s) sans lancer, à moins qu'une autre équipe ne s'y fasse enfermer.`
      : `Vous passez un tour : encore ${remaining} jour(s) sans lancer.`;
  }
  if (rollsRemaining(state, today, rollsPerDay) <= 0) {
    return 'Vous avez utilisé tous vos lancers du jour. Revenez demain.';
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
  // Le meme ordre que rollRefusal, pour que le statut affiche et le message de
  // refus ne racontent jamais deux histoires differentes.
  if (state.finishedAt) return 'arrivee';
  if (state.questionPending) {
    return state.position === FINISH_SQUARE ? 'question_finale' : 'question_en_attente';
  }
  if (bonusRolls(state) > 0) return 'relance_oie';
  if (daysBetween(today, state.nextRollAllowedDay) > 0) {
    return state.inPuits ? 'dans_le_puits' : 'tour_passe';
  }
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
 * Square 0 has none, the oie squares and la mort are never stopped on, and an
 * unconfigured square must not block a team for ever. Square 63 is the one
 * exception worth naming: its question is the final one, and a board saved
 * without it simply hands the enigma over on arrival, as before.
 */
export function squareHasQuestion(square: OieSquare): boolean {
  return !!square.question && square.acceptedAnswers.length > 0;
}

/** Does this square offer a souffleur hint? */
export function squareHasHint(square: OieSquare): boolean {
  return square.type === 'souffleur' && !!square.hint;
}
