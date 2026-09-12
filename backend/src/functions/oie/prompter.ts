import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error } from '../../utils/response';
import { OieAccessError, requirePlayer } from './context';
import { findSquare, parisDay, squareHasHint } from './rules';
import { OieConflictError, getBoard, getTeamState, logEvent, putTeamState } from './store';

/**
 * POST /oie/prompter
 *
 * Asks the souffleur for the hint of the current square. Free, but recorded:
 * knowing who needed a hint is part of what the organiser will want to read.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const player = await requirePlayer(event);

    const now = new Date();
    const nowIso = now.toISOString();
    const today = parisDay(now);

    const board = await getBoard();
    const state = await getTeamState(player.teamId, today, nowIso);
    const square = findSquare(board.squares, state.position);

    if (!squareHasHint(square)) {
      return error('Le souffleur n\'a rien à dire sur cette case', 404);
    }

    const alreadyAsked = (state.hintedSquares || []).includes(state.position);

    if (!alreadyAsked) {
      await putTeamState(
        {
          ...state,
          hintedSquares: [...(state.hintedSquares || []), state.position],
          updatedAt: nowIso,
        },
        state.version
      );

      await logEvent({
        type: 'souffleur',
        teamId: player.teamId,
        teamName: player.teamName,
        userId: player.userId,
        occurredAt: nowIso,
        message: `${player.teamName} demande l'aide du souffleur en case ${state.position}`,
        detail: { squareNumber: state.position },
      });
    }

    return success({
      squareNumber: state.position,
      hint: square.hint,
      firstTime: !alreadyAsked,
    });
  } catch (err: any) {
    if (err instanceof OieAccessError) {
      return error(err.message, err.statusCode);
    }
    if (err instanceof OieConflictError) {
      return error(err.message, 409);
    }
    console.error('Error asking the oie prompter:', err);
    return error(err.message || 'Impossible de joindre le souffleur');
  }
};
