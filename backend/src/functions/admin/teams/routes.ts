import { routeur } from '../../../utils/routeur';
import { handler as list } from './list';
import { handler as progressGrid } from './progressGrid';
import { handler as get } from './get';
import { handler as resetHints } from './resetHints';
import { handler as getProgress } from './getProgress';

/** Équipes vues par l'orga : une seule fonction Lambda (utils/routeur). */
export const handler = routeur({
  'GET /admin/teams': list,
  'GET /admin/teams/progress-grid': progressGrid,
  'GET /admin/teams/{teamId}': get,
  'POST /admin/teams/{teamId}/hints/reset': resetHints,
  'GET /admin/teams/{teamId}/progress': getProgress,
});
