import { describe, test, expect, beforeAll } from '@jest/globals';
import { asLeader } from '../helpers/users.js';
import { currentEnvironment } from '../config/test-config.js';

/**
 * Cloisonnement du back-office.
 *
 * L'authorizer ne contrôle que la validité du jeton et l'existence du compte :
 * il ne vérifie pas `isAdmin`. Ce contrôle est fait handler par handler, via
 * requireAdmin(). Un endpoint d'administration qui oublierait cet appel serait
 * donc ouvert à tout participant connecté, sans que rien ne le signale.
 *
 * Ces tests valident la propriété qui compte : muni d'un jeton de participant
 * ordinaire, aucun endpoint d'administration ne répond.
 *
 * Seules des lectures sont tentées. Les endpoints qui modifient l'état du jeu
 * — démarrage du rallye, création ou suppression de contenu — ne sont pas
 * sollicités ici : si le cloisonnement venait à céder, le test lui-même
 * causerait le dommage qu'il cherche à prévenir.
 */
describe('Cloisonnement du back-office', () => {
  let participant;

  beforeAll(async () => {
    participant = await asLeader();
  });

  const endpointsAdmin = [
    '/admin/teams',
    '/admin/teams/progress-grid',
    '/admin/users',
    '/admin/users/all',
    '/admin/enigmas',
    '/admin/enigmas/by-difficulty',
    '/admin/parcours',
    '/admin/attempts',
    '/admin/leaderboard',
    '/admin/stats/overview',
    '/admin/stats/password-attempts-timeline',
    '/admin/hints/requests',
    '/admin/auth/verify',
  ];

  test('le compte utilisé pour ce test n\'est pas administrateur', async () => {
    // Sans cette vérification, la suite entière passerait pour de mauvaises raisons.
    const verification = await participant.get('/admin/auth/verify');

    expect(verification.status).not.toBe(200);
  });

  test.each(endpointsAdmin)('%s est refusé à un participant connecté', async (endpoint) => {
    const reponse = await participant.get(endpoint);

    // 403 attendu (compte connu, droits insuffisants) ; 401 accepté si
    // l'endpoint rejette plus tôt.
    expect([401, 403]).toContain(reponse.status);

    // Un refus ne doit rien laisser filtrer du contenu administrable.
    const corps = JSON.stringify(reponse.data ?? '');
    expect(corps).not.toMatch(/correctPassword|"teams"\s*:|"users"\s*:|leaderboard/i);
  });

  test('un jeton de participant ne permet pas de démarrer le rallye', async () => {
    // Vérifié uniquement hors production : un échec du cloisonnement
    // démarrerait le jeu pour de bon.
    if (currentEnvironment().name === 'prod') return;

    const reponse = await participant.post('/admin/game/start', {});

    expect([401, 403]).toContain(reponse.status);
  });
});
