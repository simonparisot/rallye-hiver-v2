import { test, expect } from './fixtures.js';

/**
 * Contrôles d'ensemble : l'application se charge, se rend, et ne produit ni
 * erreur JavaScript ni réponse serveur en échec. Ces tests ne dépendent
 * d'aucun libellé ni d'aucune classe CSS : ils resteront valides après la
 * refonte visuelle de 2027.
 */
test.describe('Chargement de l\'application', () => {
  test('la page d\'accueil se rend', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/rallye/i);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('aucune erreur JavaScript au chargement', async ({ page, erreursConsole }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    expect(erreursConsole).toEqual([]);
  });

  test('aucune réponse serveur en erreur au chargement', async ({ page, requetesEchouees }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    expect(requetesEchouees).toEqual([]);
  });

  test('la page reste lisible sur un écran de téléphone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Un débordement horizontal est le défaut de mise en page le plus courant
    // et le plus visible sur mobile.
    const debordement = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );

    expect(debordement, 'la page ne doit pas défiler horizontalement').toBe(false);
  });
});
