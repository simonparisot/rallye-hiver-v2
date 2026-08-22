import { test as setup, expect } from '@playwright/test';
import { SESSION_FILE, seedSession } from './fixtures.js';
import { asLeader } from '../helpers/users.js';
import { config } from '../config/test-config.js';

/**
 * Ouvre une session de participant et l'enregistre pour les autres projets.
 *
 * L'authentification passe ici par l'API, pas par le formulaire : le formulaire
 * est testé pour lui-même dans `auth.spec.ts`, et le faire rejouer avant chaque
 * scénario les rendrait tous dépendants de son habillage — précisément ce que la
 * refonte 2027 va changer.
 */
setup('ouvrir une session de participant', async ({ page }) => {
  const client = await asLeader();
  const tokens = client.getTokens();

  expect(tokens?.accessToken, 'jeton d\'accès obtenu').toBeTruthy();
  expect(client.user?.teamId, 'le compte pilote appartient à l\'équipe de test')
    .toBe(config.teamId);

  await seedSession(page, tokens!);
  await page.goto('/');

  // La session n'est réputée valide que si l'application la reconnaît.
  await expect(page.locator('#root')).not.toBeEmpty();

  await page.context().storageState({ path: SESSION_FILE });
});
