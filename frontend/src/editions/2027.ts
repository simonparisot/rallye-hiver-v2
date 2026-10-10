import { Edition } from './types';

/**
 * Édition 2027 — thème « Le théâtre », direction « L'Affiche ».
 *
 * La palette découle du logo retenu par les organisateurs — les deux masques,
 * comédie et tragédie — mais en aplats d'affiche plutôt qu'en velours de
 * salle. Le pourquoi est en tête de themes/2027.css.
 */
export const edition2027: Edition = {
  gameId: 'rallye-2027',
  year: 2027,
  label: "Rallye d'Hiver 2027",
  theme: {
    key: '2027',
    name: 'Le théâtre',
    // Abril Fatface pour les titres : c'est déjà la police de rallyehiver.fr,
    // ce qui relie l'édition au site du Rallye. Lora pour le texte courant :
    // un serif de lecture, qui tient le petit corps sur téléphone là où une
    // grasse d'affiche devient illisible.
    fonts: 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Lora:ital,wght@0,400..700;1,400..600&display=swap',
    // Les deux masques, comédie et tragédie, retenus par les organisateurs.
    logo: '/logo-2027.jpg',
  },
  // Le rallye est calé sur le ciel : il ouvre à l'instant du solstice d'hiver
  // et ferme à celui de l'équinoxe de printemps. D'où les heures, qui ne sont
  // pas des horaires de bureau. Heure de Paris, CET les deux fois (le passage
  // à l'heure d'été 2027 n'a lieu que le 28 mars).
  startsAt: '2026-12-21T21:50:00+01:00',
  endsAt: '2027-03-20T21:24:00+01:00',
  copy: {
    tagline: 'Édition Hiver 2027 · Le théâtre',
    intro: "Vous êtes sur le site de l'édition 2027 du Rallye d'Hiver, qui lèvera le rideau au solstice d'hiver, le lundi 21 décembre 2026 à 21 h 50, et le baissera à l'équinoxe de printemps, le samedi 20 mars 2027 à 21 h 24.",
    duration: 'du 21 décembre 2026 au 20 mars 2027',
  },
  // Essai isolé de 2027 : une des vingt intrigues se joue sur un plateau de jeu
  // de l'oie partagé. Retirer ce champ suffit à faire disparaître le plateau,
  // sa route, son entrée d'administration et son lien dans la liste.
  enigmeOie: {
    enigmaId: process.env.REACT_APP_OIE_ENIGMA_ID || '',
    route: '/oie',
    titre: "Le jeu de l'oie du théâtre",
  },
};
