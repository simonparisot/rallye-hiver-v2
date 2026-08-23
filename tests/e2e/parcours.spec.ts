import { test, expect, ouvrirSection } from './fixtures.js';
import { resetTestTeamProgress } from '../helpers/cleanup.js';

/**
 * Scénarios 3, 6 et 8 par l'interface : consulter un parcours, le télécharger,
 * le marquer comme réalisé — et revenir sur cette complétion, ce qui rend le
 * scénario rejouable et sans trace.
 */
test.describe('Parcours', () => {
  // Le test de complétion enregistre réellement côté serveur, y compris quand
  // l'affichage ne suit pas : sans remise à zéro, le test suivant ne trouverait
  // plus le bouton « Marquer comme réalisé ».
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

  test('[défaut connu] le détail reflète la complétion sans avoir à rouvrir', async ({ page }) => {
    // Constaté : l'API répond 200 et enregistre bien la complétion, mais le
    // panneau ouvert continue d'afficher « Marquer comme réalisé ».
    // selectedParcours (ParcoursPanel.tsx:37) est une copie figée prise au clic ;
    // les mutations invalident les requêtes, ce qui rafraîchit la liste, mais
    // rien ne resynchronise le détail affiché.
    // Pour le participant, le clic paraît sans effet — et il reclique.
    test.fail();

    await page.goto('/');
    await ouvrirSection(page, 'parcours');
    await page.getByTestId('parcours-card-1').click();
    await expect(page.getByTestId('parcours-expanded-view')).toBeVisible();

    await page.getByTestId('parcours-complete-button').click();

    await expect(page.getByTestId('parcours-completed-banner')).toBeVisible({ timeout: 10_000 });
  });

  test('6. un parcours peut être marqué comme réalisé, puis remis en état', async ({ page }) => {
    await page.goto('/');
    await ouvrirSection(page, 'parcours');
    await page.getByTestId('parcours-card-1').click();
    await expect(page.getByTestId('parcours-expanded-view')).toBeVisible();

    await page.getByTestId('parcours-complete-button').click();
    // Le rechargement contourne le défaut d'affichage ci-dessus : ce test
    // vérifie que la complétion est bien enregistrée, pas qu'elle s'affiche.
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: 'networkidle' });
    // Un rechargement ramène à la section par défaut.
    await ouvrirSection(page, 'parcours');
    await page.getByTestId('parcours-card-1').click();

    await expect(page.getByTestId('parcours-completed-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('parcours-completed-badge-1')).toBeVisible();

    // Retour à l'état initial : le scénario ne laisse rien derrière lui.
    await page.getByTestId('parcours-uncomplete-button').click();
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: 'networkidle' });
    // Un rechargement ramène à la section par défaut.
    await ouvrirSection(page, 'parcours');
    await page.getByTestId('parcours-card-1').click();

    await expect(page.getByTestId('parcours-complete-button')).toBeVisible({ timeout: 15_000 });
  });
});
