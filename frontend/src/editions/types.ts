/**
 * Ce qui appartient à une édition, et rien d'autre.
 *
 * Le contenu des intrigues vit en base ; ce fichier ne décrit que l'habillage et
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
   * Les mots du jeu : ce qu'on résout, ce qu'on parcourt, avec qui. Ils
   * suivent le thème (en 2027, les intrigues, les tournées, la troupe) et
   * doivent donc changer avec l'habillage. Voir editions/vocabulaire.ts.
   */
  vocabulaire: Vocabulaire;

  /**
   * Intrigue jouée sur un plateau de jeu de l'oie partagé — essai de 2027.
   *
   * C'est le seul point d'entrée de cette intrigue dans l'application : sans ce
   * champ, ni la route du plateau, ni l'entrée d'administration, ni le lien
   * depuis la liste des intrigues n'existent. Une édition qui ne le déclare pas
   * ignore tout de `src/oie/`.
   */
  enigmeOie?: EnigmeOie;

  /**
   * Habillage neutre, affiché tant que le thème de l'édition doit rester
   * secret — avant le lancement, puis pour une équipe qui ne l'a pas encore
   * débloqué. Il remplace le thème, les textes et le titre du jeu de l'oie ;
   * tout ce qui relève du jeu (gameId, dates, route du plateau) reste celui
   * de l'édition.
   *
   * Sans ce champ, l'édition s'affiche toujours avec son thème officiel.
   * La bascule entre les deux est décrite dans editions/index.ts.
   */
  habillageNeutre?: Habillage;
}

/** Ce qui change entre l'habillage officiel d'une édition et son habillage neutre. */
export interface Habillage {
  theme: Edition['theme'];
  copy: Edition['copy'];
  vocabulaire: Vocabulaire;
  /** Titre de la page du jeu de l'oie, quand l'édition en a un. */
  titreOie?: string;
}

/** Configuration de l'intrigue jouée sur un plateau de jeu de l'oie partagé. */
export interface EnigmeOie {
  /**
   * Identifiant de l'intrigue ordinaire créée par l'admin pour le jeu de l'oie.
   * Quand il est renseigné, l'entrée correspondante de la liste mène au plateau
   * au lieu d'ouvrir un PDF et un champ de mot de passe.
   *
   * Il est lu dans l'environnement de build pour ne pas avoir à recompiler
   * quand l'intrigue est recréée ; le plateau reste jouable sans lui, seul le
   * lien depuis la liste disparaît.
   */
  enigmaId: string;

  /** Route de la page du plateau. */
  route: string;

  /** Titre affiché en tête de la page du plateau. */
  titre: string;
}

/**
 * Un nom du jeu, avec toutes les formes dont les phrases ont besoin.
 *
 * On ne substitue jamais un mot dans une phrase figée : « une tournée » est
 * féminin, « un parcours » masculin et invariable au pluriel. Chaque forme est
 * donc écrite en entier, et les accords passent par `accorder()`.
 */
export interface Nom {
  /** « intrigue », « parcours » */
  singulier: string;
  /** « intrigues », « parcours » */
  pluriel: string;
  /** « Intrigue », « Parcours » : titres, débuts de phrase. */
  Singulier: string;
  /** « Intrigues », « Parcours » */
  Pluriel: string;
  /** « une intrigue », « un parcours » */
  un: string;
  /** « cette intrigue », « ce parcours » */
  ce: string;
  /** « l'intrigue », « le parcours » */
  le: string;
  /** « de l'intrigue », « du parcours » */
  du: string;
  /** « les intrigues », « les parcours » */
  les: string;
  /** « d'intrigues », « de parcours » : après une quantité. */
  dePluriel: string;
  /** Genre grammatical, pour `accorder()`. */
  feminin: boolean;
}

/** Le vocabulaire du jeu sous un habillage donné. */
export interface Vocabulaire {
  /** Ce qu'on résout : intrigue (thème) ou énigme (neutre). */
  enigme: Nom;
  /** Ce qu'on parcourt à pied : tournée (thème) ou parcours (neutre). */
  parcours: Nom;
  /** Le groupe de joueurs : troupe (thème) ou équipe (neutre). */
  equipe: Nom;
  /** Celui qui donne les indices : souffleur (thème) ou aide (neutre). */
  souffleur: Nom;
  /** Onglet de l'équipe : « Ma troupe », « Mon équipe ». Le possessif change. */
  monEquipe: string;
}
