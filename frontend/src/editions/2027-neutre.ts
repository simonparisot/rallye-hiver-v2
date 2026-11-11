import { Habillage } from './types';
import { vocabulaireNeutre } from './vocabulaire';

/**
 * Habillage neutre de l'édition 2027, direction « L'Affiche d'hiver ».
 *
 * Le thème de 2027 ne doit pas pouvoir être deviné avant le lancement du
 * 21 décembre 2026, ni ensuite par une équipe qui ne l'a pas débloqué. Rien
 * ici ne doit y faire allusion : ni dans les textes, ni dans le nom des
 * polices, ni dans le logo. Le pourquoi des choix graphiques est en tête de
 * themes/2027-neutre.css.
 */
export const habillageNeutre2027: Habillage = {
  theme: {
    key: '2027-neutre',
    name: 'Édition 2027',
    // Archivo Black pour les titres, Source Sans 3 pour le texte : deux
    // familles d'affichage et de lecture sans connotation particulière.
    fonts: 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Source+Sans+3:ital,wght@0,400..700;1,400..600&display=swap',
    // Monogramme typographique, commun à toutes les éditions.
    logo: '/logo-rallye.svg',
  },
  copy: {
    tagline: 'Édition Hiver 2027',
    intro: "Vous êtes sur le site de l'édition 2027 du Rallye d'Hiver, qui débutera au solstice d'hiver, le lundi 21 décembre 2026 à 21 h 50, et se terminera à l'équinoxe de printemps, le samedi 20 mars 2027 à 21 h 24.",
    duration: 'du 21 décembre 2026 au 20 mars 2027',
  },
  // Énigmes, parcours, équipe : le vocabulaire d'avant 2027.
  vocabulaire: vocabulaireNeutre,
  titreOie: "Le jeu de l'oie",
};
