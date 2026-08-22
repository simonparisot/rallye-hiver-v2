/**
 * Supprime les comptes de test jetables laissés par un run interrompu.
 *
 *   TEST_ENV=test node scripts/sweep.js
 *   TEST_ENV=prod ALLOW_PROD_WRITES=1 node scripts/sweep.js [minutes]
 *
 * Par défaut, seuls les comptes de plus de 60 minutes sont concernés, afin de
 * ne pas emporter ceux d'un run en cours.
 */
import { sweepOrphanedParticipants } from '../helpers/cleanup.js';
import { requireCapability, SCOPED, currentEnvironment } from '../config/test-config.js';

const minutes = Number(process.argv[2] ?? 60);

requireCapability(SCOPED);
const env = currentEnvironment();

console.log(`Balayage sur « ${env.name} » — comptes jetables de plus de ${minutes} min`);

const supprimes = await sweepOrphanedParticipants({ olderThanMinutes: minutes });

if (supprimes.length === 0) {
  console.log('  aucun compte orphelin');
} else {
  for (const email of supprimes) console.log(`  supprimé : ${email}`);
  console.log(`\n${supprimes.length} compte(s) supprimé(s).`);
}
