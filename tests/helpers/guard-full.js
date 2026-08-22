import { beforeAll } from '@jest/globals';
import { requireCapability, FULL, currentEnvironment } from '../config/environments.js';

/**
 * Garde-fou appliqué à toutes les suites du dossier `api/`.
 *
 * Ces tests créent des comptes et des équipes sans retenue : ils n'ont de sens
 * que sur un environnement jetable. Le contrôle est posé ici, au niveau de la
 * suite, plutôt que dans chaque test — un test qui appellerait directement
 * /auth/signup sans passer par les helpers serait sinon libre d'écrire en
 * production.
 */
beforeAll(() => {
  requireCapability(FULL);
  const env = currentEnvironment();
  console.log(`Environnement : ${env.name} (${env.apiUrl})`);
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
