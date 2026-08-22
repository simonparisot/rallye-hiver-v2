import { test, expect } from './fixtures.js';

/**
 * Régression visuelle.
 *
 * Ces captures servent surtout à la refonte 2027 : elles diront exactement ce
 * qui change à l'écran, et permettront de distinguer les changements voulus des
 * effets de bord. Quand la nouvelle interface sera arrêtée, les références
 * seront régénérées d'un coup avec `--update-snapshots`.
 *
 * Les zones dont le contenu dépend des données (compteurs, dates, nom d'équipe)
 * sont masquées : sans cela, la moindre variation de progression ferait échouer
 * la comparaison sans rien signaler d'utile.
 */

const TAILLES = [
  { nom: 'mobile', width: 375, height: 812 },
  { nom: 'tablette', width: 768, height: 1024 },
  { nom: 'bureau', width: 1440, height: 900 },
];

test.describe('Aspect général', () => {
  // Sans session : l'écran d'accueil, le plus stable de tous.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const taille of TAILLES) {
    test(`accueil déconnecté — ${taille.nom}`, async ({ page }) => {
      await page.setViewportSize({ width: taille.width, height: taille.height });
      await page.goto('/', { waitUntil: 'networkidle' });

      // Neutralise les animations, qui rendraient la capture non reproductible.
      await page.addStyleTag({
        content: `*, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
        }`,
      });

      await expect(page).toHaveScreenshot(`accueil-${taille.nom}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
