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
      return error('Saisissez une réponse', 400);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const today = parisDay(now);

    const board = await getBoard();
    const state = await getTeamState(player.teamId, today, nowIso);

    if (state.finishedAt) {
      return error('Votre équipe est déjà arrivée en case 63', 400);
    }

    if (!state.questionPending) {
      return error('Aucune question n\'est en attente pour votre équipe', 400);
    }

    const square = findSquare(board.squares, state.position);

    if (!squareHasQuestion(square)) {
      return error('Cette case n\'a pas encore de question configurée', 409);
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
        ? `${player.teamName} répond juste en case ${state.position}`
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

    // Annoncer « vous pouvez relancer » alors que le quota du jour est epuise
    // serait contradictoire avec le message de blocage juste en dessous : la
    // bonne reponse ne promet un lancer que s'il est reellement disponible.
    return success({
      correct,
      message: correct
        ? view.me.canRoll
          ? 'Bonne réponse. Vous pouvez relancer les dés.'
          : 'Bonne réponse.'
        : 'Ce n\'est pas la bonne réponse. Réessayez.',
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
