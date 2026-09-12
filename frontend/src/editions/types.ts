/**
 * Ce qui appartient à une édition, et rien d'autre.
 *
 * Le contenu des énigmes vit en base ; ce fichier ne décrit que l'habillage et
 * le calendrier — ce qui change chaque année et n'a aucune raison d'être écrit
 * en dur dans les composants, comme ce fut le cas jusqu'à l'édition 2026.
 */
export interface Edition {
  /** Identifiant employé côté serveur pour rattacher la progression. */
  gameId: string;

  /** Année de fin : l'édition court sur deux années civiles. */
  year: number;

  /** Nom affiché, tel qu'il apparaît sur le site et dans les communications. */
  label: string;

  /** Thème de l'année, qui donne son habillage au site. */
  theme: {
    /** Valeur de l'attribut data-edition, à laquelle répondent les feuilles de style. */
    key: string;
    /** Nom du thème, pour les mentions éditoriales. */
    name: string;
    /** Polices à charger. Chargées à la demande : une édition n'emporte pas celles des autres. */
    fonts: string;
    /** Logo de l'édition, servi depuis public/. */
    logo: string;
  };

  /** Bornes du jeu, en ISO. Servent aux textes comme aux contrôles d'ouverture. */
  startsAt: string;
  endsAt: string;

  /** Textes propres à l'édition, regroupés pour éviter leur dispersion. */
  copy: {
    tagline: string;
    intro: string;
    duration: string;
  };

  /**
   * Énigme jouée sur un plateau de jeu de l'oie partagé — essai de 2027.
   *
   * C'est le seul point d'entrée de cette énigme dans l'application : sans ce
   * champ, ni la route du plateau, ni l'entrée d'administration, ni le lien
   * depuis la liste des énigmes n'existent. Une édition qui ne le déclare pas
   * ignore tout de `src/oie/`.
   */
  enigmeOie?: EnigmeOie;
}

/** Configuration de l'énigme jouée sur un plateau de jeu de l'oie partagé. */
export interface EnigmeOie {
  /**
   * Identifiant de l'énigme ordinaire créée par l'admin pour le jeu de l'oie.
   * Quand il est renseigné, l'entrée correspondante de la liste mène au plateau
   * au lieu d'ouvrir un PDF et un champ de mot de passe.
   *
   * Il est lu dans l'environnement de build pour ne pas avoir à recompiler
   * quand l'énigme est recréée ; le plateau reste jouable sans lui, seul le
   * lien depuis la liste disparaît.
   */
  enigmaId: string;

  /** Route de la page du plateau. */
  route: string;

  /** Titre affiché en tête de la page du plateau. */
  titre: string;
}
