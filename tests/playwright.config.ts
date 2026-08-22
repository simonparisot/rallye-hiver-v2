import { defineConfig, devices } from '@playwright/test';
import { ENVIRONMENTS } from './config/environments.js';
import { SESSION_FILE } from './e2e/fixtures.js';

/**
 * Tests de navigateur du Rallye d'Hiver.
 *
 * La cible suit la même règle que les tests d'API : elle vient de TEST_ENV et de
 * config/environments.js, jamais d'une valeur écrite en dur ici, afin qu'aucune
 * configuration locale ne puisse rediriger les tests vers la production.
 */
const env = ENVIRONMENTS[process.env.TEST_ENV || 'test'];

if (!env) {
  throw new Error(`Environnement inconnu : "${process.env.TEST_ENV}".`);
}

export default defineConfig({
  testDir: './e2e',
  // Les scénarios partagent une équipe de test unique : les exécuter en
  // parallèle les ferait interférer (progression, demandes d'adhésion).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: env.siteUrl,
    // Conserver de quoi comprendre un échec sans avoir à le reproduire.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },

  projects: [
    // Ouvre une session une fois et la partage : les autres projets n'ont pas à
    // repasser par le formulaire, qui est lui-même testé par `auth.spec.ts`.
    { name: 'session', testMatch: /auth\.setup\.ts/ },

    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: SESSION_FILE,
      },
      dependencies: ['session'],
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], storageState: SESSION_FILE },
      dependencies: ['session'],
      // La refonte 2027 étant mobile-first, ces parcours comptent autant que
      // ceux du bureau.
      testMatch: /(auth|enigmes|parcours)\.spec\.ts/,
    },
  ],
});
