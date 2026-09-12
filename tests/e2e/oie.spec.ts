import { test, expect } from './fixtures.js';

/**
 * Jeu de l'oie (édition 2027) par le navigateur.
 *
 * Le plateau est partagé et le quota de lancers est d'un par jour : un test qui
 * lancerait les dés à chaque exécution priverait l'équipe de test de son lancer
 * et deviendrait non rejouable. Ce scénario vérifie donc ce qui ne coûte rien —
 * le plateau s'affiche, la carte d'action dit quoi faire, le formulaire de
 * réponse répond — et ne lance les dés que si le bouton est réellement
 * disponible, ce qui reste vrai au plus une fois par jour.
 */
test.describe('Jeu de l\'oie', () => {
  test('le plateau des 64 cases est affiché', async ({ page }) => {
    await page.goto('/oie');

    await expect(page.getByTestId('oie-page')).toBeVisible();
    await expect(page.getByTestId('oie-plateau')).toBeVisible();

    // Les bornes du plateau, puis les cases spéciales du théâtre.
    await expect(page.getByTestId('oie-case-0')).toBeVisible();
    await expect(page.getByTestId('oie-case-63')).toBeVisible();
    await expect(page.getByTestId('oie-case-31')).toBeVisible();
    await expect(page.getByTestId('oie-case-52')).toBeVisible();

    const cases = page.locator('[data-testid^="oie-case-"]');
    expect(await cases.count()).toBe(64);
  });

  test('le pion de mon équipe est sur le plateau', async ({ page }) => {
    await page.goto('/oie');

    await expect(page.getByTestId('oie-plateau')).toBeVisible();
    await expect(page.locator('.oie-pion-mien').first()).toBeVisible();
  });

  test('la carte d\'action dit ce qu\'il y a à faire', async ({ page }) => {
    await page.goto('/oie');

    const carte = page.getByTestId('oie-carte-action');
    await expect(carte).toBeVisible();
    await expect(page.getByTestId('oie-quota')).toBeVisible();

    // À tout instant, une seule chose est possible : répondre, ou lancer, ou
    // attendre. Au moins l'un des trois doit être présenté.
    const question = page.getByTestId('oie-formulaire-reponse');
    const lancer = page.getByTestId('oie-bouton-lancer');
    const blocage = page.getByTestId('oie-blocage');

    const visible =
      (await question.isVisible().catch(() => false)) ||
      (await lancer.isVisible().catch(() => false)) ||
      (await blocage.isVisible().catch(() => false));

    expect(visible).toBe(true);
  });

  test('le fil d\'événements et le classement sont affichés', async ({ page }) => {
    await page.goto('/oie');

    await expect(page.getByTestId('oie-classement')).toBeVisible();
    await expect(page.getByTestId('oie-fil-evenements')).toBeVisible();
  });

  test('une réponse fausse est refusée sans débloquer le lancer', async ({ page }) => {
    await page.goto('/oie');
    await expect(page.getByTestId('oie-carte-action')).toBeVisible();

    const formulaire = page.getByTestId('oie-formulaire-reponse');
    if (!(await formulaire.isVisible().catch(() => false))) {
      test.skip(true, 'aucune question en attente pour l\'équipe de test');
      return;
    }

    await page.getByTestId('oie-champ-reponse').fill('reponse manifestement fausse 12345');
    await page.getByTestId('oie-bouton-repondre').click();

    await expect(page.getByTestId('oie-reponse-fausse')).toBeVisible();
    await expect(page.getByTestId('oie-bouton-lancer')).toBeDisabled();
  });

  test('un lancer disponible annonce les dés et la case d\'arrivée', async ({ page }) => {
    await page.goto('/oie');
    await expect(page.getByTestId('oie-carte-action')).toBeVisible();

    const bouton = page.getByTestId('oie-bouton-lancer');
    if (await bouton.isDisabled()) {
      test.skip(true, 'le quota du jour est déjà consommé, ou une question attend');
      return;
    }

    await bouton.click();

    const resultat = page.getByTestId('oie-resultat-lancer');
    await expect(resultat).toBeVisible();
    await expect(page.getByTestId('oie-de-1')).toBeVisible();
    await expect(page.getByTestId('oie-de-2')).toBeVisible();
    await expect(page.getByTestId('oie-trajet')).toContainText('case');
  });

  test('aucune erreur de console pendant la visite du plateau', async ({ page, erreursConsole, requetesEchouees }) => {
    await page.goto('/oie');
    await expect(page.getByTestId('oie-plateau')).toBeVisible();

    expect(erreursConsole).toEqual([]);
    expect(requetesEchouees).toEqual([]);
  });
});
