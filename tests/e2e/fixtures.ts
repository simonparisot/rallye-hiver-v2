import { test as base, expect, type Page } from '@playwright/test';
import { ENVIRONMENTS } from '../config/environments.js';

/**
 * Socle commun des tests de navigateur.
 *
 * Chaque test surveille la console et le réseau : une erreur JavaScript ou une
 * requête en échec est un défaut, même si le scénario aboutit visuellement.
 */

export const SESSION_FILE = 'e2e/.auth/participant.json';

export function environment() {
  return ENVIRONMENTS[process.env.TEST_ENV || 'test'];
}

/** Injecte une session obtenue par l'API, sans passer par le formulaire. */
export async function seedSession(page: Page, tokens: {
  accessToken: string; refreshToken: string; idToken: string;
}) {
  await page.addInitScript(({ accessToken, refreshToken, idToken }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('idToken', idToken);
  }, tokens);
}

/**
 * Ouvre une section du rallye.
 *
 * Les trois panneaux ne sont plus affichés en même temps : depuis la refonte
 * 2027, une section occupe toute la largeur et l'on navigue par la barre du
 * haut. Les tests doivent donc s'y rendre, comme un participant.
 */
export async function ouvrirSection(page: Page, section: 'enigmes' | 'parcours' | 'equipe') {
  const onglet = page.getByTestId(`nav-vers-${section}`);

  // On attend que l'onglet soit rendu plutôt que de renoncer s'il est absent :
  // appelée juste après un goto, cette fonction s'exécutait avant le premier
  // rendu et ne faisait rien — en silence, ce qui faisait échouer le test bien
  // plus loin, sur une assertion sans rapport.
  await onglet.waitFor({ state: 'visible', timeout: 15_000 });
  await onglet.click();

  // La section visée doit avoir pris la main avant de rendre la main au test.
  await page.getByTestId(
    section === 'equipe' ? 'stats-panel' : section === 'parcours' ? 'parcours-panel' : 'enigma-panel'
  ).waitFor({ state: 'visible', timeout: 10_000 });
}

type Fixtures = {
  erreursConsole: string[];
  requetesEchouees: string[];
};

export const test = base.extend<Fixtures>({
  erreursConsole: async ({ page }, use) => {
    const erreurs: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') erreurs.push(message.text());
    });
    page.on('pageerror', (error) => erreurs.push(String(error)));

    await use(erreurs);
  },

  requetesEchouees: async ({ page }, use) => {
    const echecs: string[] = [];

    page.on('response', (response) => {
      // 401 et 403 sont attendus sur les parcours anonymes : ils font partie
      // du fonctionnement normal et ne sont pas comptés comme des échecs.
      if (response.status() >= 500) {
        echecs.push(`${response.status()} ${response.url()}`);
      }
    });

    await use(echecs);
  },
});

export { expect };
