import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error } from '../../utils/response';
import { OieAccessError, requirePlayer } from './context';
import { findSquare, isAnswerCorrect, parisDay, squareHasQuestion } from './rules';
import { OieConflictError, getBoard, getTeamState, logEvent, putTeamState } from './store';
import { buildBoardView } from './view';

/**
 * POST /oie/answer  { answer }
 *
 * Answers the question of the square the team stands on. Attempts are
 * unlimited and all logged; only a correct answer gives back the right to roll.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const player = await requirePlayer(event);

    const body = JSON.parse(event.body || '{}');
    const answer = typeof body.answer === 'string' ? body.answer : '';

    if (!answer.trim()) {
      return error('Saisissez une reponse', 400);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const today = parisDay(now);

    const board = await getBoard();
    const state = await getTeamState(player.teamId, today, nowIso);

    if (state.finishedAt) {
      return error('Votre equipe est deja arrivee en case 63', 400);
    }

    if (!state.questionPending) {
      return error('Aucune question n\'est en attente pour votre equipe', 400);
    }

    const square = findSquare(board.squares, state.position);

    if (!squareHasQuestion(square)) {
      return error('Cette case n\'a pas encore de question configuree', 409);
    }

    const correct = isAnswerCorrect(answer, square.acceptedAnswers);

    // Journalise avant d'ecrire l'etat : une tentative reste tracee meme si
    // l'ecriture conditionnelle echoue ensuite.
    await logEvent({
      type: correct ? 'reponse_juste' : 'reponse_fausse',
      teamId: player.teamId,
      teamName: player.teamName,
      userId: player.userId,
      occurredAt: nowIso,
      message: correct
        ? `${player.teamName} repond juste en case ${state.position}`
        : `${player.teamName} se trompe en case ${state.position}`,
      detail: { squareNumber: state.position, answer },
    });

    const next = {
      ...state,
      questionPending: correct ? false : true,
      wrongAnswers: correct ? state.wrongAnswers : state.wrongAnswers + 1,
      updatedAt: nowIso,
    };

    await putTeamState(next, state.version);

    const view = await buildBoardView(
      { ...board },
      { ...next, version: state.version + 1 },
      player.teamId,
      player.teamName,
      today
    );

    return success({
      correct,
      message: correct
        ? 'Bonne reponse. Vous pouvez relancer les des.'
        : 'Ce n\'est pas la bonne reponse. Reessayez.',
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
    return error(err.message || 'Impossible d\'enregistrer la reponse');
  }
};
