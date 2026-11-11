import { routeur } from '../../../utils/routeur';
import { getHandler, putHandler, deleteHandler } from './wrongPasswordMessages';

/** Messages de mauvais mot de passe : une seule fonction Lambda (utils/routeur). */
export const handler = routeur({
  'GET /admin/settings/wrong-password-messages': getHandler,
  'PUT /admin/settings/wrong-password-messages': putHandler,
  'DELETE /admin/settings/wrong-password-messages': deleteHandler,
});
