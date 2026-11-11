import { routeur } from '../../../utils/routeur';
import { getHandler, putHandler } from './board';
import { listHandler, resetHandler } from './teams';

/** Administration du jeu de l'oie : une seule fonction Lambda (utils/routeur). */
export const handler = routeur({
  'GET /admin/oie/board': getHandler,
  'PUT /admin/oie/board': putHandler,
  'GET /admin/oie/teams': listHandler,
  'POST /admin/oie/teams/{teamId}/reset': resetHandler,
});
