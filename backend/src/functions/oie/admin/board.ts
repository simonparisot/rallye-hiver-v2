import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { OieSquare } from '../../../types/oie';
import { FINISH_SQUARE } from '../rules';
import { getBoard, saveBoard } from '../store';

/**
 * GET /admin/oie/board
 *
 * The full board, questions and answers included: this is the admin view.
 */
export const getHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return error('Authentication required', 401);
    await requireAdmin(userId);

    const board = await getBoard();
    return success({ board });
  } catch (err: any) {
    console.error('Error loading the oie board (admin):', err);
    return error(err.message || 'Impossible de charger le plateau', err.message === 'Admin access required' ? 403 : 500);
  }
};

/**
 * PUT /admin/oie/board  { squares, rollsPerDay, enigmaId }
 *
 * Replaces the whole configuration. The same payload shape is what the admin
 * page imports and exports as JSON, so the organiser can prepare the sixty odd
 * questions in a file rather than in a form.
 */
export const putHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return error('Authentication required', 401);
    await requireAdmin(userId);

    const body = JSON.parse(event.body || '{}');

    if (!Array.isArray(body.squares)) {
      return error('Le champ squares est obligatoire et doit être un tableau', 400);
    }

    const rollsPerDay = Number(body.rollsPerDay);
    if (!Number.isInteger(rollsPerDay) || rollsPerDay < 1 || rollsPerDay > 20) {
      return error('rollsPerDay doit être un entier entre 1 et 20', 400);
    }

    const invalid = body.squares.find(
      (square: any) =>
        !Number.isInteger(square?.squareNumber) ||
        square.squareNumber < 0 ||
        square.squareNumber > FINISH_SQUARE
    );
    if (invalid) {
      return error(`Numéro de case invalide : ${JSON.stringify(invalid?.squareNumber)}`, 400);
    }

    const squares: OieSquare[] = body.squares.map((square: any) => ({
      squareNumber: square.squareNumber,
      type: square.type,
      question: typeof square.question === 'string' ? square.question.trim() || undefined : undefined,
      acceptedAnswers: Array.isArray(square.acceptedAnswers)
        ? square.acceptedAnswers.map((answer: any) => String(answer).trim()).filter(Boolean)
        : [],
      hint: typeof square.hint === 'string' ? square.hint.trim() || undefined : undefined,
      flavor: typeof square.flavor === 'string' ? square.flavor.trim() || undefined : undefined,
    }));

    const enigmaId = typeof body.enigmaId === 'string' && body.enigmaId.trim()
      ? body.enigmaId.trim()
      : undefined;

    const board = await saveBoard(squares, rollsPerDay, enigmaId, userId);

    return success({ board });
  } catch (err: any) {
    console.error('Error saving the oie board:', err);
    return error(err.message || 'Impossible d\'enregistrer le plateau', err.message === 'Admin access required' ? 403 : 500);
  }
};
