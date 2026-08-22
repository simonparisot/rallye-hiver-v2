import { beforeAll } from '@jest/globals';
import { requireCapability, SCOPED, currentEnvironment } from '../config/environments.js';
import { config } from '../config/test-config.js';

/**
 * Garde-fou des scénarios fonctionnels.
 *
 * Ces tests s'exécutent aussi bien sur l'environnement de test qu'en production :
 * ils n'agissent que sur l'équipe de test et sur des participants jetables, et
 * effacent leurs traces. Le niveau `scoped` suffit donc — mais il est exigé.
 */
beforeAll(() => {
  requireCapability(SCOPED);

  if (!config.teamId) {
    throw new Error(
      'TEST_TEAM_ID absent. Lance d\'abord : TEST_ENV=<env> node scripts/provision.js'
    );
  }

  const env = currentEnvironment();
  console.log(`Scénarios sur « ${env.name} » — équipe de test ${config.teamId}`);
});

import { afterAll } from '@jest/globals';
import { pendingCleanup, clearCleanupRegistry } from './users.js';
import { deleteParticipant } from './cleanup.js';

/**
 * Purge des comptes créés pendant la suite, quelle qu'en soit l'issue.
 * Un test qui échoue en cours de route ne doit pas laisser de compte derrière lui.
 */
afterAll(async () => {
  const restes = pendingCleanup();
  clearCleanupRegistry();

  for (const { email, userId } of restes) {
    try {
      await deleteParticipant({ email, userId });
    } catch (err) {
      console.warn(`  nettoyage de ${email} : ${err.message}`);
    }
  }
}, 60000);
