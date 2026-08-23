import { Edition } from './types';

/**
 * Édition 2026 — thème « bande dessinée ».
 *
 * Conservée telle qu'elle a tourné : 2026.rallyehiver.fr continue de la servir
 * indéfiniment. Elle n'est plus l'édition active, mais reste reconstructible.
 */
export const edition2026: Edition = {
  gameId: 'rallye-2025',
  year: 2026,
  label: "Rallye d'Hiver 2026",
  theme: {
    key: '2026',
    name: 'Bande dessinée',
    fonts: 'https://fonts.googleapis.com/css2?family=Bangers&family=Poppins:wght@400;600&family=Comic+Neue:ital@0;1&display=swap',
    logo: '/logo.png',
  },
  startsAt: '2025-12-21',
  endsAt: '2026-03-20',
  copy: {
    tagline: 'Édition Hiver 2026',
    intro: "Vous êtes sur le site de l'édition 2026 du Rallye d'Hiver, qui débutera le 21 décembre 2025 et se terminera le 20 mars 2026.",
    duration: 'du 21 décembre 2025 au 20 mars 2026',
  },
};
