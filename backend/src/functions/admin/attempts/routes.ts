import { routeur } from '../../../utils/routeur';
import { handler as list } from './list';
import { handler as byTeam } from '../getAttemptsByTeam';
import { handler as byEnigma } from '../getAttemptsByEnigma';

/** Tentatives vues par l'orga : une seule fonction Lambda (utils/routeur). */
export const handler = routeur({
  'GET /admin/attempts': list,
  'GET /admin/attempts/team/{teamId}': byTeam,
  'GET /admin/attempts/enigma/{enigmaId}': byEnigma,
});
