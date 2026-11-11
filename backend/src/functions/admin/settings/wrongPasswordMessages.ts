import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import {
  DEFAULT_WRONG_PASSWORD_MESSAGES,
  MAX_WRONG_PASSWORD_MESSAGES,
  MAX_WRONG_PASSWORD_MESSAGE_LENGTH,
  StoredWrongPasswordMessages,
  WrongPasswordMessagesValidationError,
  getStoredWrongPasswordMessages,
  resetWrongPasswordMessages,
  setWrongPasswordMessages,
} from '../../../utils/wrongPasswordMessages';

/**
 * Messages servis au hasard quand une équipe donne un mauvais mot de passe.
 *
 * GET    /admin/settings/wrong-password-messages
 * PUT    /admin/settings/wrong-password-messages  { messages: string[] }
 * DELETE /admin/settings/wrong-password-messages  (retour aux messages par défaut)
 *
 * Les trois renvoient la même forme : la liste en vigueur, si c'est la liste
 * par défaut, la liste par défaut elle-même et les limites de validation.
 */
function view(stored: StoredWrongPasswordMessages) {
  return {
    messages: stored.messages,
    isDefault: stored.isDefault,
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
    defaults: [...DEFAULT_WRONG_PASSWORD_MESSAGES],
    limits: {
      maxMessages: MAX_WRONG_PASSWORD_MESSAGES,
      maxLength: MAX_WRONG_PASSWORD_MESSAGE_LENGTH,
    },
  };
}

function failure(err: any, fallback: string): APIGatewayProxyResult {
  if (err?.message === 'Admin access required') {
    return error('Admin access required', 403);
  }
  if (err instanceof WrongPasswordMessagesValidationError) {
    return error(err.message, 400);
  }
  console.error(fallback, err);
  return error(err?.message || fallback, 500);
}

export const getHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return error('Authentication required', 401);
    await requireAdmin(userId);

    return success(view(await getStoredWrongPasswordMessages()));
  } catch (err: any) {
    return failure(err, 'Impossible de charger les messages de mauvais mot de passe');
  }
};

export const putHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return error('Authentication required', 401);
    await requireAdmin(userId);

    let body: any;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Corps de requête JSON invalide', 400);
    }

    return success(view(await setWrongPasswordMessages(body?.messages, userId)));
  } catch (err: any) {
    return failure(err, "Impossible d'enregistrer les messages de mauvais mot de passe");
  }
};

export const deleteHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return error('Authentication required', 401);
    await requireAdmin(userId);

    return success(view(await resetWrongPasswordMessages()));
  } catch (err: any) {
    return failure(err, 'Impossible de rétablir les messages par défaut');
  }
};
