import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error } from '../../utils/response';
import { OieAccessError, narrateEffect, requirePlayer } from './context';
import { OieTeamState } from '../../types/oie';
import { finishRankAmong, markEnigmaSolved } from './finish';
import {
  addDays,
  bonusRolls,
  FINISH_SQUARE,
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

    // Un lancer du a une oie ne coute rien au quota du jour : c'est tout son
    // interet. Il est donc consomme en premier, et ne fait pas avancer le
    // compteur quotidien.
    const usesBonus = bonusRolls(state) > 0;

    const dice = rollDice();
    const total = dice[0] + dice[1];
    const move = resolveMove(state.position, total, state.overshootCount);

    const landedSquare = findSquare(board.squares, move.position);
    const finishSquare = findSquare(board.squares, FINISH_SQUARE);

    // Arriver en 63 ne gagne plus rien par soi-meme : la question finale y
    // attend, et c'est sa reponse qui emporte l'enigme. Un plateau sans
    // question finale configuree se comporte comme avant, pour ne jamais
    // laisser une equipe bloquee sur l'oubli d'un organisateur.
    const awaitsFinalQuestion = move.finished && squareHasQuestion(finishSquare);
    const winsNow = move.finished && !awaitsFinalQuestion;

    const next: OieTeamState = {
      ...state,
      position: move.position,
      // Une case sans question configuree ne doit jamais bloquer une equipe.
      questionPending: move.finished ? awaitsFinalQuestion : squareHasQuestion(landedSquare),
      inPuits: move.inPuits,
      inPrison: move.inPrison,
      // Atteindre la 63 ferme le plateau : plus aucun lancer a rendre, meme si
      // une oie venait d'en promettre un.
      bonusRolls: move.finished
        ? 0
        : (usesBonus ? bonusRolls(state) - 1 : bonusRolls(state)) + (move.bonusRoll ? 1 : 0),
      // Passer un tour : la penalite couvre la fin de la journee en cours plus
      // les jours suivants (loge 1, prison 2, puits 3).
      nextRollAllowedDay:
        move.skippedDays > 0 ? addDays(today, move.skippedDays + 1) : state.nextRollAllowedDay,
      rollsUsedToday: rollsUsedOn(state, today) + (usesBonus ? 0 : 1),
      rollsDay: today,
      totalRolls: state.totalRolls + 1,
      overshootCount: move.overshootCount,
      updatedAt: nowIso,
    };

    // Le rang d'arrivee est fige au moment ou l'equipe emporte l'enigme ; la
    // date est conservee pour pouvoir le recalculer si besoin.
    let allStates = await getAllTeamStates();
    if (winsNow) {
      next.finishedAt = nowIso;
      next.finishRank = finishRankAmong(allStates, player.teamId);
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

    // Arrivee en 63 : la question finale entre en scene, et le journal le dit,
    // pour que les autres equipes voient que la course n'est pas finie.
    if (awaitsFinalQuestion) {
      const message = `La question finale attend ${player.teamName} en case 63`;
      journal.push(message);
      await logEvent({
        type: 'arrivee',
        teamId: player.teamId,
        teamName: player.teamName,
        userId: player.userId,
        occurredAt: horodatage(),
        message,
        detail: { totalRolls: next.totalRolls, wrongAnswers: next.wrongAnswers },
      });
    }

    // Plateau sans question finale : l'enigme est resolue des l'arrivee, comme
    // avant, exactement comme un mot de passe trouve.
    if (winsNow && board.enigmaId) {
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
      // Deux nouvelles distinctes depuis la question finale : le pion est en
      // 63, et l'enigme est emportee.
      reachedFinish: move.finished,
      awaitsFinalQuestion,
      finished: winsNow,
      bonusRoll: move.bonusRoll,
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
