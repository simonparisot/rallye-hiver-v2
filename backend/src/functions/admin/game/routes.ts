import { routeur } from '../../../utils/routeur';
import { handler as start } from './start';
import { handler as status } from './status';
import { handler as reset } from './reset';

/** Phase du jeu côté orga : une seule fonction Lambda (utils/routeur). */
export const handler = routeur({
  'POST /admin/game/start': start,
  'GET /admin/game/status': status,
  'POST /admin/game/reset': reset,
});
