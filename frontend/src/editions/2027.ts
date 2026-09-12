/**
 * Configuration de l'edition 2027, « Le theatre ».
 *
 * Ce fichier est le seul point d'entree du jeu de l'oie dans l'application :
 * une edition qui ne declare pas `enigmeOie` n'affiche ni la route /oie, ni le
 * lien dans la liste des enigmes. C'est ce qui permet de garder l'essai 2027
 * isole sans le melanger aux autres editions.
 *
 * Si le projet « ameliorations graphiques » introduit un registre d'editions
 * plus complet, ce fichier doit y etre absorbe en conservant le champ
 * `enigmeOie` tel quel.
 */

/** Enigme jouee sur un plateau de jeu de l'oie partage. */
export interface EditionEnigmeOie {
  /**
   * Identifiant de l'enigme ordinaire creee par l'admin pour le jeu de l'oie.
   * Quand il est renseigne, l'entree correspondante de la liste des enigmes
   * mene a /oie au lieu d'ouvrir un PDF et un champ de mot de passe.
   *
   * Il est lu dans l'environnement de build pour ne pas avoir a recompiler
   * quand l'admin recree l'enigme ; le plateau reste jouable meme sans lui,
   * seul le lien depuis la liste disparait.
   */
  enigmaId: string;
  /** Route de la page du plateau. */
  route: string;
  /** Titre affiche en tete de la page du plateau. */
  titre: string;
}

export interface EditionConfig {
  annee: number;
  /** Nom de l'edition, tel qu'il est annonce aux equipes. */
  titre: string;
  /** Classe posee sur la page pour activer le theme visuel de l'edition. */
  theme: string;
  enigmeOie?: EditionEnigmeOie;
}

export const edition2027: EditionConfig = {
  annee: 2027,
  titre: 'Le theatre',
  theme: 'edition-2027',
  enigmeOie: {
    enigmaId: process.env.REACT_APP_OIE_ENIGMA_ID || '',
    route: '/oie',
    titre: "Le jeu de l'oie du theatre",
  },
};

/** Edition en cours. */
export const editionCourante = edition2027;
