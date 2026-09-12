import { test, expect } from './fixtures.js';
import { config } from '../config/test-config.js';

/**
 * Scénario 1 — authentification, par l'interface.
 *
 * C'est le seul endroit où le formulaire est réellement exercé : les autres
 * scénarios réutilisent une session ouverte par l'API, pour ne pas dépendre de
 * l'habillage du formulaire, qui changera en 2027.
 */
test.describe('Authentification', () => {
  // Ces tests partent nécessairement d'un navigateur sans session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('un visiteur voit le formulaire de connexion', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('auth-panel')).toBeVisible();
    await expect(page.getByTestId('auth-email-input')).toBeVisible();
    await expect(page.getByTestId('auth-password-input')).toBeVisible();
    await expect(page.getByTestId('auth-submit')).toBeVisible();
  });

  test('le mot de passe n\'est pas affiché en clair', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('auth-password-input')).toHaveAttribute('type', 'password');
  });

  test('un membre se connecte et accède au jeu', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('auth-email-input').fill(config.fixtureUsers.leader.email);
    await page.getByTestId('auth-password-input').fill(config.fixtureUsers.leader.password!);
    await page.getByTestId('auth-submit').click();

    // Le panneau d'authentification cède la place au jeu. Depuis la refonte,
    // une seule section est affichée à la fois : les énigmes à l'arrivée, les
    // autres accessibles par la barre de navigation.
    await expect(page.getByTestId('enigma-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('nav-vers-parcours')).toBeVisible();
    await expect(page.getByTestId('nav-vers-equipe')).toBeVisible();
    await expect(page.getByTestId('auth-panel')).toHaveCount(0);
  });

  test('[défaut connu] un mot de passe erroné affiche un message d\'erreur', async ({ page }) => {
    // Constaté : l'API répond bien 401, mais aucun message n'apparaît et le
    // formulaire se vide. Le catch de AuthPanel appelle pourtant setError() —
    // le composant est remonté, ce qui réinitialise champs et message.
    // Pour un participant, se tromper de mot de passe est donc indiscernable
    // d'une panne. Ce test passera au vert une fois le défaut corrigé.
    test.fail();

    await page.goto('/');

    await page.getByTestId('auth-email-input').fill(config.fixtureUsers.leader.email);
    await page.getByTestId('auth-password-input').fill('MauvaisMotDePasse!9');
    await page.getByTestId('auth-submit').click();

    await expect(page.getByTestId('auth-error')).toBeVisible({ timeout: 10_000 });
  });

  test('un mot de passe erroné n\'ouvre pas le jeu', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('auth-email-input').fill(config.fixtureUsers.leader.email);
    await page.getByTestId('auth-password-input').fill('MauvaisMotDePasse!9');
    await page.getByTestId('auth-submit').click();
    await page.waitForTimeout(3000);

    // Ce qui compte pour la sécurité reste vrai : le jeu ne s'ouvre pas.
    await expect(page.getByTestId('enigma-panel')).toHaveCount(0);
    await expect(page.getByTestId('auth-panel')).toBeVisible();
  });

  test('l\'inscription est accessible depuis la connexion', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('auth-signup-tab').click();

    // L'inscription demande un nom affiché, contrairement à la connexion.
    await expect(page.getByTestId('auth-displayname-input')).toBeVisible();
    await expect(page.getByTestId('auth-email-input')).toBeVisible();
  });

  test('la session est conservée après rechargement', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-email-input').fill(config.fixtureUsers.leader.email);
    await page.getByTestId('auth-password-input').fill(config.fixtureUsers.leader.password!);
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('enigma-panel')).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.getByTestId('enigma-panel')).toBeVisible();
    await expect(page.getByTestId('auth-panel')).toHaveCount(0);
  });
});
