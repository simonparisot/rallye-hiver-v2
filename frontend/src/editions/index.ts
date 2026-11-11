import { useSyncExternalStore } from 'react';
import { Edition } from './types';
import { edition2026 } from './2026';
import { edition2027 } from './2027';

export type { Edition, Habillage, Nom, Vocabulaire } from './types';
export { accorder, majuscule } from './vocabulaire';

const EDITIONS: Record<string, Edition> = {
  '2026': edition2026,
  '2027': edition2027,
};

/**
 * Édition servie par ce build, avec son thème officiel.
 *
 * REACT_APP_EDITION permet de reconstruire une édition passée à l'identique —
 * c'est ce qui rend 2026.rallyehiver.fr reproductible plutôt que figé.
 */
export const editionOfficielle: Edition =
  EDITIONS[process.env.REACT_APP_EDITION ?? ''] ?? edition2027;

/**
 * La même édition sous son habillage neutre, quand elle en déclare un : seuls
 * le thème, les textes et le titre du jeu de l'oie changent. Le jeu (gameId,
 * dates, route et identifiant du plateau) reste celui de l'édition.
 */
const editionNeutre: Edition | null = editionOfficielle.habillageNeutre
  ? {
      ...editionOfficielle,
      theme: editionOfficielle.habillageNeutre.theme,
      copy: editionOfficielle.habillageNeutre.copy,
      vocabulaire: editionOfficielle.habillageNeutre.vocabulaire,
      enigmeOie: editionOfficielle.enigmeOie && {
        ...editionOfficielle.enigmeOie,
        titre: editionOfficielle.habillageNeutre.titreOie ?? editionOfficielle.enigmeOie.titre,
      },
    }
  : null;

/* ---------------------------------------------------------------------------
   Bascule entre le thème officiel et l'habillage neutre

   Par défaut, c'est l'habillage neutre qui s'affiche, partout : page d'accueil,
   espace connecté, administration. Le thème officiel n'apparaît qu'après un
   appel à setThemeOfficiel(true), sans rechargement.
   --------------------------------------------------------------------------- */

/*
 * INTERRUPTEUR PROVISOIRE, RÉSERVÉ AUX TESTS — À RETIRER AVANT LE LANCEMENT
 * DU 21 DÉCEMBRE 2026.
 *
 * `?theme=officiel` dans l'URL affiche le thème officiel pour le reste de la
 * session de l'onglet (sessionStorage) ; `?theme=neutre` revient à l'habillage
 * neutre. Il n'est protégé par rien : n'importe qui connaissant le paramètre
 * voit le thème. Il sert à prévisualiser en attendant la règle réelle.
 */
const CLE_INTERRUPTEUR = 'rallye-theme-apercu';

function lireInterrupteurProvisoire(): boolean {
  try {
    const demande = new URLSearchParams(window.location.search).get('theme');
    if (demande === 'officiel') window.sessionStorage.setItem(CLE_INTERRUPTEUR, 'officiel');
    if (demande === 'neutre') window.sessionStorage.removeItem(CLE_INTERRUPTEUR);
    return window.sessionStorage.getItem(CLE_INTERRUPTEUR) === 'officiel';
  } catch {
    // Stockage bloqué (navigation privée, tests) : habillage neutre.
    return false;
  }
}

let themeOfficiel = lireInterrupteurProvisoire();
const abonnes = new Set<() => void>();

/** Édition telle qu'elle doit s'afficher en ce moment. */
export function editionAffichee(): Edition {
  return themeOfficiel || !editionNeutre ? editionOfficielle : editionNeutre;
}

/** Le thème officiel est-il affiché ? */
export function estThemeOfficiel(): boolean {
  return themeOfficiel || !editionNeutre;
}

/**
 * Affiche le thème officiel (true) ou l'habillage neutre (false), à chaud :
 * attribut data-edition, polices, puis tous les composants abonnés via
 * useEdition() se redessinent (logo, textes).
 *
 * POINT D'ENTRÉE DE LA RÈGLE DE DÉBLOCAGE (tâche 6, à spécifier) : c'est cette
 * fonction que la règle appellera, avec true quand l'équipe connectée a
 * débloqué le thème officiel et false sinon — y compris à la déconnexion, pour
 * qu'un poste partagé ne garde pas le thème. Tant qu'elle n'existe pas, seul
 * l'interrupteur provisoire ci-dessus l'appelle, au chargement. Attention : un
 * appel avec false écrase cet interrupteur pour la page en cours.
 */
export function setThemeOfficiel(officiel: boolean): void {
  if (officiel === themeOfficiel) return;
  themeOfficiel = officiel;
  applyEditionTheme();
  abonnes.forEach((prevenir) => prevenir());
}

function abonner(prevenir: () => void): () => void {
  abonnes.add(prevenir);
  return () => {
    abonnes.delete(prevenir);
  };
}

/**
 * L'édition affichée, pour tout ce qui se voit : logo, textes, titre. Le
 * composant se redessine quand on bascule de thème.
 *
 * Pas besoin de fournisseur de contexte : l'état vit dans ce module et
 * useSyncExternalStore s'y abonne, ce qui marche aussi dans l'administration
 * et dans les pages chargées à la demande.
 */
export function useEdition(): Edition {
  return useSyncExternalStore(abonner, editionAffichee, editionAffichee);
}

/** Le thème officiel est-il affiché ? Se met à jour à la bascule. */
export function useThemeOfficiel(): boolean {
  return useSyncExternalStore(abonner, estThemeOfficiel, estThemeOfficiel);
}

/**
 * Constante historique, gardée pour les composants qui n'ont pas encore migré
 * vers useEdition().
 *
 * Ce qui relève du jeu (gameId, year, dates, enigmeOie) est celui de
 * l'édition. Ce qui relève de l'habillage (theme, copy, vocabulaire) suit l'édition
 * affichée : sans quoi un composant non migré afficherait le logo officiel
 * sous l'habillage neutre et trahirait le thème. Un tel composant ne se
 * redessine pas tout seul à la bascule ; App s'abonne à useEdition() et
 * redessine l'arbre, ce qui suffit tant qu'aucun n'est mémoïsé.
 */
export const edition: Edition = Object.defineProperties(
  { ...editionOfficielle },
  {
    theme: { get: () => editionAffichee().theme, enumerable: true },
    copy: { get: () => editionAffichee().copy, enumerable: true },
    vocabulaire: { get: () => editionAffichee().vocabulaire, enumerable: true },
  }
);

/**
 * Applique l'habillage affiché : l'attribut auquel répondent les feuilles de
 * style, et le chargement des polices correspondantes.
 *
 * Les polices sont chargées ici plutôt que dans index.html pour qu'une édition
 * n'emporte jamais celles des autres, ni l'habillage neutre celles du thème
 * officiel (leur nom suffirait à mettre sur la piste).
 */
export function applyEditionTheme(): void {
  const affichee = editionAffichee();
  document.documentElement.setAttribute('data-edition', affichee.theme.key);
  document.title = affichee.label;

  const id = `edition-fonts-${affichee.theme.key}`;
  if (document.getElementById(id)) return;

  const lien = document.createElement('link');
  lien.id = id;
  lien.rel = 'stylesheet';
  lien.href = affichee.theme.fonts;
  document.head.appendChild(lien);
}
