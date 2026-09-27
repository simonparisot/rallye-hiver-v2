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
 *
 * La zone est repliée tant qu'on ne la demande pas : ouvrir une énigme ne doit
 * plus faire apparaître le formulaire, seulement le bouton qui l'appelle. Les
 * tests passent donc par `ouvrirSouffleur`.
 */
/** Ouvre une énigme puis déplie la zone du souffleur. */
async function ouvrirSouffleur(page: import('@playwright/test').Page, numero: number) {
  await page.goto('/');
  await page.getByTestId(`enigma-card-${numero}`).click();
  await page.getByTestId('hint-trigger').click();
  await expect(page.getByTestId('hint-progress-input')).toBeVisible();
}

test.describe('Demande d\'indice', () => {
  let enigme: Awaited<ReturnType<typeof enigmaWithHints>>;

  test.beforeAll(async () => {
    enigme = await enigmaWithHints();
  });

  test.beforeEach(async () => {
    test.skip(!enigme, 'Aucune énigme dotée d\'indices dans cet environnement.');
  });

  test('rien ne s\'affiche tant qu\'on ne clique pas sur l\'icône', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`enigma-card-${enigme!.enigmaNumber}`).click();

    // Ce qu'on vient lire en ouvrant une énigme, c'est l'énoncé : le formulaire
    // ne doit pas s'interposer entre la barre de réponse et le PDF.
    await expect(page.getByTestId('hint-section')).toBeVisible();
    await expect(page.getByTestId('hint-trigger')).toBeVisible();
    await expect(page.getByTestId('hint-progress-input')).toBeHidden();
    await expect(page.getByTestId('hint-cost-warning')).toBeHidden();
    // Les indices déjà donnés vivent dans la fenêtre, pas sous l'énigme.
    await expect(page.getByTestId('hint-obtained-list')).toBeHidden();
  });

  test('l\'icône ouvre la fenêtre, avec sa consigne et son avertissement', async ({ page }) => {
    await ouvrirSouffleur(page, enigme!.enigmaNumber);

    await expect(page.getByTestId('hint-cost-warning')).toBeVisible();
    // Une fenêtre modale, pas un dépliant : le fond est voilé.
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('le bouton reste inactif tant que la description est trop courte', async ({ page }) => {
    await ouvrirSouffleur(page, enigme!.enigmaNumber);

    const bouton = page.getByTestId('hint-request-button');
    await expect(bouton).toBeDisabled();

    await page.getByTestId('hint-progress-input').fill('bloqué');
    await expect(bouton).toBeDisabled();
    await expect(page.getByTestId('hint-counter')).toContainText('caractères');
  });

  test('le risque est annoncé avant la confirmation, et l\'annulation ne demande rien', async ({ page }) => {
    await ouvrirSouffleur(page, enigme!.enigmaNumber);

    await page.getByTestId('hint-progress-input').fill(
      "Nous avons relevé les sept horloges et tenté plusieurs additions, sans résultat. " +
      "Nous pensons que le papier peint cache quelque chose mais nous n'avançons plus."
    );

    const bouton = page.getByTestId('hint-request-button');
    await expect(bouton).toBeEnabled();

    // Le coût est annoncé avant toute action irréversible, et il dit le vrai :
    // le texte est tiré de nextHintCost, que l'API met à zéro tant que le
    // barème dort (backend/src/utils/hintCost.ts).
    await expect(page.getByTestId('hint-cost-warning')).toContainText(/ne coûte aucun point|un quart des points/);

    await bouton.click();
    await expect(page.getByTestId('hint-confirm')).toBeVisible();
    await expect(page.getByTestId('hint-confirm-button')).toBeVisible();

    // On s'arrête ici : confirmer appellerait le modèle, ce qui coûte de l'argent
    // et prend plusieurs secondes.
    await page.getByTestId('hint-cancel-button').click();
    await expect(page.getByTestId('hint-confirm')).toBeHidden();
    await expect(page.getByTestId('hint-request-button')).toBeVisible();
  });

  test('le coût annoncé est celui que le serveur applique', async ({ page }) => {
    await ouvrirSouffleur(page, enigme!.enigmaNumber);

    const intro = page.getByTestId('hint-cost-warning');
    await expect(intro).toBeVisible();
    // Un chiffre n'a le droit d'apparaître que si le serveur en prélève un.
    // Tant que le barème dort, la fenêtre doit dire que l'indice est gratuit.
    const texte = (await intro.textContent()) ?? '';
    const chiffre = /\d+\s*points?/.test(texte);
    const gratuit = /ne coûte aucun point/.test(texte);
    expect(chiffre !== gratuit).toBe(true);
  });

  test('changer d\'énigme referme la zone et vide le champ', async ({ page }) => {
    await ouvrirSouffleur(page, enigme!.enigmaNumber);
    await page.getByTestId('hint-progress-input')
      .fill('Un texte saisi pour cette énigme précise, et pour elle seule.');

    const autre = enigme!.enigmaNumber === 1 ? 2 : 1;
    const carteAutre = page.getByTestId(`enigma-card-${autre}`);
    test.skip(!(await carteAutre.count()), 'Une seule énigme dans cet environnement.');

    await carteAutre.click();
    // La zone se replie : le texte saisi pour une énigme ne doit pas être
    // proposé pour la suivante, ni le formulaire rester ouvert.
    await expect(page.getByTestId('hint-progress-input')).toBeHidden();

    await page.getByTestId(`enigma-card-${enigme!.enigmaNumber}`).click();
    await page.getByTestId('hint-trigger').click();
    await expect(page.getByTestId('hint-progress-input')).toHaveValue('');
  });
});
