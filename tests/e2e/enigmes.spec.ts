import { test, expect } from './fixtures.js';
import { enigmaWithSolution } from '../helpers/enigmas.js';
import { resetTestTeamProgress } from '../helpers/cleanup.js';

/**
 * Scénarios 2, 4, 5 et 7 par l'interface : consulter une énigme, la télécharger,
 * soumettre une réponse fausse puis la bonne.
 *
 * La progression de l'équipe de test est remise à zéro avant et après, pour que
 * le scénario soit rejouable et ne laisse aucune trace dans les statistiques.
 */
test.describe('Énigmes', () => {
  let enigme: Awaited<ReturnType<typeof enigmaWithSolution>>;

  test.beforeAll(async () => {
    enigme = await enigmaWithSolution();
    await resetTestTeamProgress();
  });

  test.afterAll(async () => {
    await resetTestTeamProgress();
  });

  test('2. la liste des énigmes est affichée', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('enigma-panel')).toBeVisible();
    await expect(page.getByTestId('enigma-card-1')).toBeVisible();

    const cartes = page.locator('[data-testid^="enigma-card-"]');
    await expect(cartes.first()).toBeVisible();
    expect(await cartes.count()).toBeGreaterThan(1);
  });

  test('2. l\'ouverture d\'une énigme montre son contenu et le champ de réponse', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme.enigmaNumber}`).click();

    await expect(page.getByTestId('enigma-expanded-view')).toBeVisible();
    await expect(page.getByTestId('enigma-password-input')).toBeVisible();
    await expect(page.getByTestId('enigma-submit')).toBeVisible();
    await expect(page.getByTestId('enigma-pdf-container')).toBeVisible();
  });

  test('7. le PDF de l\'énigme est téléchargeable', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme.enigmaNumber}`).click();
    await expect(page.getByTestId('enigma-expanded-view')).toBeVisible();

    const bouton = page.getByTestId(`enigma-download-button-${enigme.enigmaNumber}`);
    await expect(bouton).toBeVisible();

    const [telechargement] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      bouton.click(),
    ]);

    expect(telechargement.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('4. une réponse fausse est refusée', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme.enigmaNumber}`).click();

    await page.getByTestId('enigma-password-input').fill('reponse-volontairement-fausse-42');
    await page.getByTestId('enigma-submit').click();

    await expect(page.getByTestId('enigma-attempt-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('enigma-attempt-success')).toHaveCount(0);
  });

  test('4. le message d\'échec ne laisse pas filtrer la solution', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme.enigmaNumber}`).click();

    await page.getByTestId('enigma-password-input').fill('encore-une-mauvaise-reponse');
    await page.getByTestId('enigma-submit').click();

    const message = page.getByTestId('enigma-attempt-error');
    await expect(message).toBeVisible({ timeout: 15_000 });

    const texte = ((await message.textContent()) ?? '').toLowerCase();
    expect(texte).not.toContain(enigme.solution.toLowerCase());
  });

  test('5. la bonne réponse résout l\'énigme', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme.enigmaNumber}`).click();

    await page.getByTestId('enigma-password-input').fill(enigme.solution);
    await page.getByTestId('enigma-submit').click();

    await expect(page.getByTestId('enigma-attempt-success')).toBeVisible({ timeout: 15_000 });
  });

  test('5. l\'énigme résolue est signalée dans la liste', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId(`enigma-solved-badge-${enigme.enigmaNumber}`))
      .toBeVisible({ timeout: 15_000 });
  });
});
