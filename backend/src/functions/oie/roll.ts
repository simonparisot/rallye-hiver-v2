import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error } from '../../utils/response';
import {
  createOrUpdateTeamProgress,
  getTeamById,
  getTeamProgress,
  updateTeam,
} from '../../utils/dynamodb';
import { OieAccessError, narrateEffect, requirePlayer } from './context';
import { OieTeamState } from '../../types/oie';
import {
  addDays,
  findSquare,
  parisDay,
  resolveMove,
  rollDice,
  rollRefusal,
  rollsUsedOn,
  squareHasQuestion,
} from './rules';
import {
  OieConflictError,
  getAllTeamStates,
  getBoard,
  getTeamState,
  logEvent,
  putTeamState,
  releaseTeam,
} from './store';
import { buildBoardView, getTeamNames } from './view';

/**
 * POST /oie/roll
 *
 * Rolls two dice on the server, moves the team, applies the special squares and
 * writes the new state under a condition so that two simultaneous clicks from
 * the same team can never count as two rolls.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const player = await requirePlayer(event);

    const now = new Date();
    const nowIso = now.toISOString();
    const today = parisDay(now);

    const board = await getBoard();
    const state = await getTeamState(player.teamId, today, nowIso);

    const refusal = rollRefusal(state, today, board.rollsPerDay);
    if (refusal) {
      return error(refusal, 400);
    }

    const dice = rollDice();
    const total = dice[0] + dice[1];
    const move = resolveMove(state.position, total, state.overshootCount, dice);

    const landedSquare = findSquare(board.squares, move.position);

    const next: OieTeamState = {
      ...state,
      position: move.position,
      // Une case sans question configuree ne doit jamais bloquer une equipe.
      questionPending: !move.finished && squareHasQuestion(landedSquare),
      inPuits: move.inPuits,
      inPrison: move.inPrison,
      // Passer un tour : la penalite couvre la fin de la journee en cours plus
      // le ou les jours suivants (loge 1 jour, prison 2 jours).
      nextRollAllowedDay:
        move.skippedDays > 0 ? addDays(today, move.skippedDays + 1) : state.nextRollAllowedDay,
      rollsUsedToday: rollsUsedOn(state, today) + 1,
      rollsDay: today,
      totalRolls: state.totalRolls + 1,
      overshootCount: move.overshootCount,
      updatedAt: nowIso,
    };

    // Le rang d'arrivee est fige au moment ou l'equipe atteint la 63 ; la date
    // est conservee pour pouvoir le recalculer si besoin.
    let allStates = await getAllTeamStates();
    if (move.finished) {
      next.finishedAt = nowIso;
      next.finishRank =
        allStates.filter((other) => other.teamId !== player.teamId && !!other.finishedAt).length + 1;
      next.questionPending = false;
      next.inPuits = false;
      next.inPrison = false;
    }

    // L'ecriture conditionnelle d'abord : tant qu'elle n'a pas abouti, rien
    // d'autre ne doit avoir bouge sur le plateau.
    await putTeamState(next, state.version);

    // Un lancer produit plusieurs lignes de journal. Sans decalage elles
    // porteraient toutes le meme horodatage, et la cle de tri les departagerait
    // par identifiant, donc au hasard : le fil raconterait l'histoire dans le
    // desordre. Une milliseconde par ligne suffit a la remettre droite.
    let rang = 0;
    const horodatage = () => new Date(now.getTime() + rang++).toISOString();

    const journal: string[] = [];
    await logEvent({
      type: 'lancer',
      teamId: player.teamId,
      teamName: player.teamName,
      userId: player.userId,
      occurredAt: horodatage(),
      message: `${player.teamName} lance ${dice[0]} et ${dice[1]} (${total}) et avance de la case ${state.position} à la case ${move.position}`,
      detail: { dice, total, from: state.position, to: move.position },
    });

    for (const effect of move.effects) {
      const message = narrateEffect(player.teamName, effect);
      if (!message) continue;
      journal.push(message);
      await logEvent({
        type: effect.kind === 'arrivee' || effect.kind === 'metteur_en_scene' ? 'arrivee' : 'case_speciale',
        teamId: player.teamId,
        teamName: player.teamName,
        userId: player.userId,
        occurredAt: horodatage(),
        message,
        detail: { effect },
      });
    }

    // Reperage : celui qui tombe dans le puits (ou en prison) delivre celui qui
    // s'y trouvait, et prend sa place.
    const releases: string[] = [];
    if (move.inPuits || move.inPrison) {
      const field = move.inPuits ? 'inPuits' : 'inPrison';
      const names = await getTeamNames();
      const held = allStates.filter(
        (other) => other.teamId !== player.teamId && (other as any)[field] === true
      );

      for (const prisoner of held) {
        const freed = await releaseTeam(prisoner.teamId, field, today, nowIso);
        if (!freed) continue;

        const prisonerName = names.get(prisoner.teamId)?.teamName || 'Une equipe';
        const message = move.inPuits
          ? `${player.teamName} repêche ${prisonerName} du puits`
          : `${player.teamName} fait libérer ${prisonerName} de la prison`;
        releases.push(message);

        await logEvent({
          type: 'liberation',
          teamId: prisoner.teamId,
          teamName: prisonerName,
          userId: player.userId,
          occurredAt: horodatage(),
          message,
          detail: { freedBy: player.teamId, field },
        });
      }
    }

    // Arrivee en 63 : l'enigme est resolue, exactement comme un mot de passe
    // trouve, pour que le classement et les statistiques existants la comptent.
    if (move.finished && board.enigmaId) {
      await markEnigmaSolved(board.enigmaId, player.teamId, nowIso);
      await logEvent({
        type: 'arrivee',
        teamId: player.teamId,
        teamName: player.teamName,
        userId: player.userId,
        occurredAt: horodatage(),
        message: `${player.teamName} termine le jeu de l'oie (rang ${next.finishRank})`,
        detail: {
          finishRank: next.finishRank,
          totalRolls: next.totalRolls,
          wrongAnswers: next.wrongAnswers,
        },
      });
    }

    const view = await buildBoardView(
      board,
      { ...next, version: state.version + 1 },
      player.teamId,
      player.teamName,
      today
    );

    return success({
      dice,
      total,
      from: state.position,
      to: move.position,
      finished: move.finished,
      effects: move.effects,
      journal,
      releases,
      ...view,
    });
  } catch (err: any) {
    if (err instanceof OieAccessError) {
      return error(err.message, err.statusCode);
    }
    if (err instanceof OieConflictError) {
      return error(err.message, 409);
    }
    console.error('Error rolling the oie dice:', err);
    return error(err.message || 'Impossible de lancer les dés');
  }
};

/**
 * Marks the jeu de l'oie enigma solved for the team, the same way
 * progress/submitAttempt.ts does for an ordinary enigma.
 */
async function markEnigmaSolved(enigmaId: string, teamId: string, now: string): Promise<void> {
  const existing = await getTeamProgress(teamId, enigmaId);

  if (existing?.solved) {
    return;
  }

  const updates: any = {
    solved: true,
    solvedAt: now,
    lastAttemptAt: now,
    attemptCount: existing?.attemptCount || 0,
    updatedAt: now,
  };

  if (!existing) {
    updates.firstAttemptAt = now;
    updates.createdAt = now;
  }

  await createOrUpdateTeamProgress(teamId, enigmaId, updates);

  const team = await getTeamById(teamId);
  await updateTeam(teamId, {
    solvedEnigmasCount: (team?.solvedEnigmasCount || 0) + 1,
    lastActivityAt: now,
  });
}
