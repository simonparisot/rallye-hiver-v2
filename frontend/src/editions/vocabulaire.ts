import { Nom, Vocabulaire } from './types';

/**
 * Le vocabulaire neutre du jeu : celui des éditions sans thème lexical (2026)
 * et de l'habillage neutre de 2027, qui ne doit rien laisser deviner.
 *
 * Le vocabulaire du thème 2027 est dans editions/2027.ts.
 */
export const vocabulaireNeutre: Vocabulaire = {
  enigme: {
    singulier: 'énigme', pluriel: 'énigmes', Singulier: 'Énigme', Pluriel: 'Énigmes',
    un: 'une énigme', ce: 'cette énigme', le: "l'énigme", du: "de l'énigme",
    les: 'les énigmes', dePluriel: "d'énigmes", feminin: true,
  },
  parcours: {
    singulier: 'parcours', pluriel: 'parcours', Singulier: 'Parcours', Pluriel: 'Parcours',
    un: 'un parcours', ce: 'ce parcours', le: 'le parcours', du: 'du parcours',
    les: 'les parcours', dePluriel: 'de parcours', feminin: false,
  },
  equipe: {
    singulier: 'équipe', pluriel: 'équipes', Singulier: 'Équipe', Pluriel: 'Équipes',
    un: 'une équipe', ce: 'cette équipe', le: "l'équipe", du: "de l'équipe",
    les: 'les équipes', dePluriel: "d'équipes", feminin: true,
  },
  souffleur: {
    singulier: 'aide', pluriel: 'aides', Singulier: 'Aide', Pluriel: 'Aides',
    un: 'une aide', ce: 'cette aide', le: "l'aide", du: "de l'aide",
    les: 'les aides', dePluriel: "d'aides", feminin: true,
  },
  monEquipe: 'Mon équipe',
};

/**
 * Choisit la forme accordée au genre du nom :
 * `accorder(v.parcours, 'réalisée', 'réalisé')` donne « réalisée » pour une
 * tournée, « réalisé » pour un parcours.
 */
export function accorder(nom: Nom, feminin: string, masculin: string): string {
  return nom.feminin ? feminin : masculin;
}

/** Met la première lettre en capitale : « Cette tournée… ». */
export function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
