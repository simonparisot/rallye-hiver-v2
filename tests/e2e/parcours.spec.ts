import { test, expect, ouvrirSection } from './fixtures.js';
import { resetTestTeamProgress } from '../helpers/cleanup.js';
import { parcoursPasswordByNumber } from '../helpers/parcours.js';

/**
 * Scénarios 3, 6 et 8 par l'interface : consulter un parcours, le télécharger,
 * le valider par son mot de passe de fin de tournée. La remise à zéro de
 * l'équipe de test avant et après chaque test rend le scénario rejouable.
 */
test.describe('Parcours', () => {
  // La validation enregistre réellement côté serveur : sans remise à zéro, le
  // test suivant ne trouverait plus le champ du mot de passe.
  test.beforeEach(async () => {
    await resetTestTeamProgress();
  });

  test.afterAll(async () => {
    await resetTestTeamProgress();
  });

  test('3. la liste des parcours est affichée', async ({ page }) => {
    await page.goto('/');
    await ouvrirSection(page, 'parcours');

    await expect(page.getByTestId('parcours-panel')).toBeVisible();

    const cartes = page.locator('[data-testid^="parcours-card-"]');
    await expect(cartes.first()).toBeVisible();
    expect(await cartes.count()).toBeGreaterThan(1);
  });

  test('3. l\'ouverture d\'un parcours montre son contenu', async ({ page }) => {
    await page.goto('/');
    await ouvrirSection(page, 'parcours');
    await page.getByTestId('parcours-card-1').click();

    await expect(page.getByTestId('parcours-expanded-view')).toBeVisible();
    await expect(page.getByTestId('parcours-details')).toBeVisible();
  });

  test('8. le PDF du parcours est téléchargeable', async ({ page }) => {
    await page.goto('/');
    await ouvrirSection(page, 'parcours');
    await page.getByTestId('parcours-card-1').click();
    await expect(page.getByTestId('parcours-expanded-view')).toBeVisible();

    const bouton = page.getByTestId('parcours-download-button-1');
    await expect(bouton).toBeVisible();

    const [telechargement] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      bouton.click(),
    ]);

    expect(telechargement.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('6. un parcours se valide par son mot de passe de fin de tournée', async ({ page }) => {
    const motDePasse = await parcoursPasswordByNumber(1);

    await page.goto('/');
    await ouvrirSection(page, 'parcours');
    await page.getByTestId('parcours-card-1').click();
    await expect(page.getByTestId('parcours-expanded-view')).toBeVisible();

    // Le détail doit être chargé avant de regarder s'il porte le formulaire :
    // isVisible() ne patiente pas, et répondrait « non » pendant le chargement.
    await expect(
      page.getByTestId('parcours-details').or(page.getByTestId('parcours-locked-view'))
    ).toBeVisible({ timeout: 15_000 });

    const formulaire = page.getByTestId('parcours-password-form');
    const ouverte = await formulaire.isVisible().catch(() => false);
    test.skip(
      !motDePasse || !ouverte,
      'La tournée 1 n\'est pas ouverte pour l\'équipe de test, ou n\'a pas de mot de passe.'
    );

    // Une mauvaise réponse est refusée, sans valider la tournée.
    await page.getByTestId('parcours-password-input').fill('reponse-volontairement-fausse-42');
    await page.getByTestId('parcours-password-submit').click();
    await expect(page.getByTestId('parcours-attempt-error')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('parcours-attempt-close').click();
    await expect(page.getByTestId('parcours-completed-banner')).toHaveCount(0);

    // La bonne réponse valide la tournée, et le détail le montre sans recharger.
    await page.getByTestId('parcours-password-input').fill(motDePasse as string);
    await page.getByTestId('parcours-password-submit').click();
    await expect(page.getByTestId('parcours-attempt-success')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('parcours-attempt-close').click();

    await expect(page.getByTestId('parcours-completed-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('parcours-completed-badge-1')).toBeVisible();
    await expect(page.getByTestId('parcours-password-form')).toHaveCount(0);
    // Plus de retour arrière côté joueur : beforeEach remet l'équipe à zéro.
  });
});
