import { Edition } from './types';

/**
 * Édition 2027 — thème « Le théâtre ».
 *
 * La palette et les polices découlent du logo retenu par les organisateurs :
 * les deux masques, comédie et tragédie.
 */
export const edition2027: Edition = {
  gameId: 'rallye-2027',
  year: 2027,
  label: "Rallye d'Hiver 2027",
  theme: {
    key: '2027',
    name: 'Le théâtre',
    // Abril Fatface pour les titres : c'est déjà la police de rallyehiver.fr,
    // ce qui relie l'édition au site du Rallye. Source Sans 3 pour le texte
    // courant, dessinée pour les longues lectures.
    fonts: 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap',
    // Les deux masques, comédie et tragédie, retenus par les organisateurs.
    logo: '/logo-2027.jpg',
  },
  startsAt: '2026-12-20',
  endsAt: '2027-03-19',
  copy: {
    tagline: 'Édition Hiver 2027 · Le théâtre',
    intro: "Vous êtes sur le site de l'édition 2027 du Rallye d'Hiver, qui débutera le 20 décembre 2026 et se terminera le 19 mars 2027.",
    duration: 'du 20 décembre 2026 au 19 mars 2027',
  },
  // Essai isolé de 2027 : une des vingt énigmes se joue sur un plateau de jeu
  // de l'oie partagé. Retirer ce champ suffit à faire disparaître le plateau,
  // sa route, son entrée d'administration et son lien dans la liste.
  enigmeOie: {
    enigmaId: process.env.REACT_APP_OIE_ENIGMA_ID || '',
    route: '/oie',
    titre: "Le jeu de l'oie du théâtre",
  },
};
