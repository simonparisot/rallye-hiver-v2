import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error } from '../../utils/response';
import { OieTeamState } from '../../types/oie';
import { OieAccessError, requirePlayer } from './context';
import { markEnigmaSolved, nextFinishRank } from './finish';
import { FINISH_SQUARE, findSquare, isAnswerCorrect, parisDay, squareHasQuestion } from './rules';
import { OieConflictError, getBoard, getTeamState, logEvent, putTeamState } from './store';
import { buildBoardView } from './view';

/**
 * POST /oie/answer  { answer }
 *
 * Answers the question of the square the team stands on. Attempts are
 * unlimited and all logged; only a correct answer gives back the right to roll.
 *
 * The question of square 63 is the final one: answering it right is what wins
 * the enigma, so this handler, not the roll, is where the board ends.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const player = await requirePlayer(event);

    const body = JSON.parse(event.body || '{}');
    const answer = typeof body.answer === 'string' ? body.answer : '';

    if (!answer.trim()) {
      return error('Saisissez une réponse', 400);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const today = parisDay(now);

    const board = await getBoard();
    const state = await getTeamState(player.teamId, today, nowIso);

    if (state.finishedAt) {
      return error('Votre équipe a déjà remporté le jeu de l\'oie', 400);
    }

    if (!state.questionPending) {
      return error('Aucune question n\'est en attente pour votre équipe', 400);
    }

    const square = findSquare(board.squares, state.position);

    if (!squareHasQuestion(square)) {
      return error('Cette case n\'a pas encore de question configurée', 409);
    }

    const correct = isAnswerCorrect(answer, square.acceptedAnswers);
    const isFinalQuestion = state.position === FINISH_SQUARE;
    const winsNow = correct && isFinalQuestion;

    // Journalise avant d'ecrire l'etat : une tentative reste tracee meme si
    // l'ecriture conditionnelle echoue ensuite. Les tentatives sur la question
    // finale ne sont pas limitees, comme partout ailleurs sur le plateau, mais
    // chacune laisse sa ligne.
    await logEvent({
      type: correct ? 'reponse_juste' : 'reponse_fausse',
      teamId: player.teamId,
      teamName: player.teamName,
      userId: player.userId,
      occurredAt: nowIso,
      message: correct
        ? isFinalQuestion
          ? `${player.teamName} répond juste à la question finale`
          : `${player.teamName} répond juste en case ${state.position}`
        : isFinalQuestion
          ? `${player.teamName} se trompe sur la question finale`
          : `${player.teamName} se trompe en case ${state.position}`,
      detail: { squareNumber: state.position, answer, finalQuestion: isFinalQuestion },
    });

    const next: OieTeamState = {
      ...state,
      questionPending: correct ? false : true,
      wrongAnswers: correct ? state.wrongAnswers : state.wrongAnswers + 1,
      updatedAt: nowIso,
    };

    // La bonne reponse a la question finale emporte l'enigme : c'est ici, et
    // nulle part ailleurs, que la partie se termine.
    if (winsNow) {
      next.finishedAt = nowIso;
      next.finishRank = await nextFinishRank(player.teamId);
      next.bonusRolls = 0;
      next.inPuits = false;
      next.inPrison = false;
    }

    await putTeamState(next, state.version);

    if (winsNow) {
      if (board.enigmaId) {
        await markEnigmaSolved(board.enigmaId, player.teamId, nowIso);
      }
      await logEvent({
        type: 'arrivee',
        teamId: player.teamId,
        teamName: player.teamName,
        userId: player.userId,
        occurredAt: new Date(now.getTime() + 1).toISOString(),
        message: `${player.teamName} remporte le jeu de l'oie (rang ${next.finishRank})`,
        detail: {
          finishRank: next.finishRank,
          totalRolls: next.totalRolls,
          wrongAnswers: next.wrongAnswers,
        },
      });
    }

    const view = await buildBoardView(
      { ...board },
      { ...next, version: state.version + 1 },
      player.teamId,
      player.teamName,
      today
    );

    // Annoncer « vous pouvez relancer » alors que le quota du jour est epuise
    // serait contradictoire avec le message de blocage juste en dessous : la
    // bonne reponse ne promet un lancer que s'il est reellement disponible.
    return success({
      correct,
      finished: winsNow,
      message: !correct
        ? 'Ce n\'est pas la bonne réponse. Réessayez.'
        : winsNow
          ? `Bonne réponse : vous remportez l'intrigue du jeu de l'oie (rang ${next.finishRank}).`
          : view.me.canRoll
            ? 'Bonne réponse. Vous pouvez relancer les dés.'
            : 'Bonne réponse.',
      ...view,
    });
  } catch (err: any) {
    if (err instanceof OieAccessError) {
      return error(err.message, err.statusCode);
    }
    if (err instanceof OieConflictError) {
      return error(err.message, 409);
    }
    console.error('Error answering an oie question:', err);
    return error(err.message || 'Impossible d\'enregistrer la réponse');
  }
};
