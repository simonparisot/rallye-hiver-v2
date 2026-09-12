import { test, expect, ouvrirSection } from './fixtures.js';

/**
 * Scénario 9 — le tableau de bord de l'équipe.
 *
 * Les valeurs sont lues sur les accroches `-value`, qui ne portent que le
 * nombre : les assertions ne dépendent donc pas des libellés, qui changeront
 * avec la refonte.
 */
test.describe('Tableau de bord', () => {
  test('9. les trois compteurs sont affichés', async ({ page }) => {
    await page.goto('/');
    await ouvrirSection(page, 'equipe');

    await expect(page.getByTestId('stats-panel')).toBeVisible();
    await expect(page.getByTestId('stats-enigmas-solved-value')).toBeVisible();
    await expect(page.getByTestId('stats-parcours-completed-value')).toBeVisible();
    await expect(page.getByTestId('stats-attempts-count-value')).toBeVisible();
  });

  test('9. les compteurs contiennent des valeurs chiffrées cohérentes', async ({ page }) => {
    await page.goto('/');
    await ouvrirSection(page, 'equipe');

    const enigmes = await page.getByTestId('stats-enigmas-solved-value').textContent();
    const parcours = await page.getByTestId('stats-parcours-completed-value').textContent();
    const tentatives = await page.getByTestId('stats-attempts-count-value').textContent();

    // Les deux premiers sont de la forme « résolues / total ».
    expect(enigmes?.trim()).toMatch(/^\d+\s*\/\s*\d+$/);
    expect(parcours?.trim()).toMatch(/^\d+\s*\/\s*\d+$/);
    expect(tentatives?.trim()).toMatch(/^\d+$/);

    const [resolues, total] = enigmes!.split('/').map((n) => parseInt(n.trim(), 10));
    expect(resolues).toBeLessThanOrEqual(total);
    expect(total).toBeGreaterThan(0);
  });

  test('9. le nom de l\'équipe est affiché', async ({ page }) => {
    await page.goto('/');
    await ouvrirSection(page, 'equipe');

    await expect(page.getByTestId('team-name')).toBeVisible();
    await expect(page.getByTestId('team-name')).not.toBeEmpty();
  });
});
