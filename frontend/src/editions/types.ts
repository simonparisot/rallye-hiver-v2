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
}
