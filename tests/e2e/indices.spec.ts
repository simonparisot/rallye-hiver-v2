import { test, expect } from './fixtures.js';
import { enigmaWithHints } from '../helpers/enigmas.js';

/**
 * Parcours joueur de la demande d'indice, par le navigateur.
 *
 * La demande n'est jamais confirmée : la confirmation déclenche un appel au
 * modèle, qui coûte de l'argent, prend quelques secondes et retire des points à
 * l'équipe de test. Ce qui est vérifié ici, c'est la mécanique de l'interface
 * jusqu'au point de non-retour — l'invitation à décrire l'avancement, le refus
 * d'un texte trop court, l'annonce du coût, l'étape de confirmation et la
 * possibilité d'annuler.
 *
 * Le chemin au-delà de la confirmation est couvert en test unitaire avec un
 * faux client de modèle (`backend/src/functions/hints/__tests__/`).
 */
test.describe('Demande d\'indice', () => {
  let enigme: Awaited<ReturnType<typeof enigmaWithHints>>;

  test.beforeAll(async () => {
    enigme = await enigmaWithHints();
  });

  test.beforeEach(async () => {
    test.skip(!enigme, 'Aucune énigme dotée d\'indices dans cet environnement.');
  });

  test('la zone de demande est visible sous une énigme non résolue', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme!.enigmaNumber}`).click();

    await expect(page.getByTestId('hint-section')).toBeVisible();
    await expect(page.getByTestId('hint-progress-input')).toBeVisible();
    await expect(page.getByTestId('hint-cost-warning')).toBeVisible();
  });

  test('le bouton reste inactif tant que la description est trop courte', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme!.enigmaNumber}`).click();

    const bouton = page.getByTestId('hint-request-button');
    await expect(bouton).toBeDisabled();

    await page.getByTestId('hint-progress-input').fill('bloqué');
    await expect(bouton).toBeDisabled();
    await expect(page.getByTestId('hint-counter')).toContainText('caractères');
  });

  test('le coût est annoncé avant la confirmation, et l\'annulation ne coûte rien', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme!.enigmaNumber}`).click();

    await page.getByTestId('hint-progress-input').fill(
      "Nous avons relevé les sept horloges et tenté plusieurs additions, sans résultat. " +
      "Nous pensons que le papier peint cache quelque chose mais nous n'avançons plus."
    );

    const bouton = page.getByTestId('hint-request-button');
    await expect(bouton).toBeEnabled();

    // L'avertissement de coût est lisible avant toute action irréversible.
    await expect(page.getByTestId('hint-cost-warning')).toContainText('point');

    await bouton.click();
    await expect(page.getByTestId('hint-confirm')).toBeVisible();
    await expect(page.getByTestId('hint-confirm-button')).toBeVisible();

    // On s'arrête ici : confirmer appellerait le modèle et facturerait l'équipe.
    await page.getByTestId('hint-cancel-button').click();
    await expect(page.getByTestId('hint-confirm')).toBeHidden();
    await expect(page.getByTestId('hint-request-button')).toBeVisible();
  });

  test('changer d\'énigme vide le champ de la précédente', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme!.enigmaNumber}`).click();

    const champ = page.getByTestId('hint-progress-input');
    await champ.fill('Un texte saisi pour cette énigme précise, et pour elle seule.');

    const autre = enigme!.enigmaNumber === 1 ? 2 : 1;
    const carteAutre = page.getByTestId(`enigma-card-${autre}`);
    test.skip(!(await carteAutre.count()), 'Une seule énigme dans cet environnement.');

    await carteAutre.click();
    // La zone peut disparaître (énigme sans indice ou déjà résolue) ; si elle
    // reste, le champ doit être vide.
    if (await page.getByTestId('hint-progress-input').count()) {
      await expect(page.getByTestId('hint-progress-input')).toHaveValue('');
    }
  });
});
