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
 * voit le thème. Il servait à prévisualiser en attendant la règle réelle ;
 * depuis qu'elle existe (setThemeOfficiel plus bas), la réponse du serveur
 * l'écrase dès qu'elle arrive.
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

/*
 * Mémoire du dernier verdict de la règle de déblocage (localStorage), pour que
 * le chargement suivant parte du bon habillage sans attendre le serveur : sans
 * elle, une équipe qui a débloqué le thème verrait l'habillage neutre à chaque
 * rechargement, le temps que GET /game/status réponde. Elle n'est écrite que
 * par setThemeOfficiel ; le serveur la corrige dès sa réponse.
 *
 * Elle est attachée à l'utilisateur : on y range l'identifiant (`sub`) du jeton
 * d'accès présent au moment du verdict, et elle ne s'applique que si un jeton
 * du même utilisateur est encore là. Un visiteur ou un autre compte sur le
 * même navigateur ne voit donc jamais le thème officiel par elle. Elle est
 * effacée partout où les jetons sont purgés (oublierThemeMemorise).
 */
const CLE_MEMOIRE = 'rallye-theme-officiel';

/** `sub` du jeton d'accès présent, sans vérifier la signature (ce n'est qu'un repère d'affichage). */
function sujetDuJeton(): string | null {
  try {
    const jeton = window.localStorage.getItem('accessToken');
    if (!jeton) return null;
    const charge = jeton.split('.')[1];
    if (!charge) return null;
    const json = atob(charge.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = JSON.parse(json)?.sub;
    return typeof sub === 'string' && sub !== '' ? sub : null;
  } catch {
    return null;
  }
}

function lireMemoire(): boolean {
  try {
    const memoire = window.localStorage.getItem(CLE_MEMOIRE);
    const sujet = sujetDuJeton();
    return !!memoire && !!sujet && memoire === sujet;
  } catch {
    return false;
  }
}

function memoriser(officiel: boolean): void {
  try {
    const sujet = sujetDuJeton();
    // Sans utilisateur connecté (visiteur après le lancement), rien à retenir.
    if (officiel && sujet) window.localStorage.setItem(CLE_MEMOIRE, sujet);
    else window.localStorage.removeItem(CLE_MEMOIRE);
  } catch {
    // Stockage bloqué : le chargement suivant attendra le serveur.
  }
}

/**
 * Efface la mémoire du thème. À appeler partout où les jetons sont purgés sans
 * passer par la déconnexion (jeton refusé, rafraîchissement échoué).
 */
export function oublierThemeMemorise(): void {
  try {
    window.localStorage.removeItem(CLE_MEMOIRE);
  } catch {
    // Stockage bloqué : rien n'a pu être mémorisé.
  }
}

let themeOfficiel = lireInterrupteurProvisoire() || lireMemoire();
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
 * POINT D'ENTRÉE DE LA RÈGLE DE DÉBLOCAGE (tâches 6 et 15). Le serveur décide
 * (`themeOfficiel` de GET /game/status : jeu lancé, ou préliminaire résolue
 * par l'équipe) et le frontend l'applique ici :
 * - au chargement et à chaque relecture du statut, et au changement
 *   d'utilisateur ou d'équipe (SynchroStatutJeu, services/statutJeu.ts) ;
 * - juste après la bonne réponse à une préliminaire (EnigmasPanel) ;
 * - à la déconnexion avant le lancement, avec false (AuthContext), pour qu'un
 *   poste partagé ne garde pas le thème.
 * Le verdict est mémorisé pour le chargement suivant. Attention : un appel avec
 * false écrase l'interrupteur provisoire pour la page en cours ; comme le
 * statut est lu à chaque chargement, l'interrupteur ne tient donc plus
 * qu'en l'absence de réponse du serveur.
 */
export function setThemeOfficiel(officiel: boolean): void {
  memoriser(officiel);
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
