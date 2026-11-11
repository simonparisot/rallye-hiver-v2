import { parisDay } from '../functions/oie/rules';

/**
 * Ouverture des indices d'une énigme.
 *
 * L'organisateur décide, énigme par énigme, si les équipes peuvent demander
 * des indices — et à partir de quand. Il peut ne jamais les ouvrir, les ouvrir
 * tout de suite, ou fixer une date : quelques semaines après la publication,
 * le temps que les équipes aient cherché par elles-mêmes.
 *
 * Fermé par défaut. Une énigme qui n'a jamais reçu de réglage n'offre pas
 * d'indice : rien ne s'ouvre sans un geste de l'organisateur, même s'il a déjà
 * rédigé les indices.
 *
 * La date se lit en jour de Paris, comme celle du plateau du jeu de l'oie :
 * « à partir du 12 janvier » veut dire dès minuit à Paris, pas à minuit UTC.
 */
export interface ReglageIndices {
  hintsEnabled?: boolean;
  /** YYYY-MM-DD, jour de Paris. Absent, vide ou null : pas de date d'attente. */
  hintsAvailableFrom?: string | null;
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai si les équipes peuvent demander un indice sur cette énigme maintenant. */
export function indicesOuverts(enigme: ReglageIndices, maintenant: Date = new Date()): boolean {
  if (enigme.hintsEnabled !== true) return false;
  const depuis = enigme.hintsAvailableFrom;
  if (!depuis) return true;
  return parisDay(maintenant) >= depuis;
}

/**
 * Valide les deux champs tels qu'ils arrivent d'un formulaire d'administration
 * et renvoie ce qu'il faut écrire. Une erreur est renvoyée en clair plutôt que
 * de stocker une date que la comparaison lexicale lirait de travers.
 */
export function lireReglageIndices(body: any): { valeurs: ReglageIndices; erreur?: string } {
  const valeurs: ReglageIndices = {};
  if (body.hintsEnabled !== undefined) {
    if (typeof body.hintsEnabled !== 'boolean') {
      return { valeurs, erreur: 'hintsEnabled doit être un booléen' };
    }
    valeurs.hintsEnabled = body.hintsEnabled;
  }
  if (body.hintsAvailableFrom !== undefined) {
    const brut = body.hintsAvailableFrom;
    if (brut === null || brut === '') {
      valeurs.hintsAvailableFrom = null;
    } else if (typeof brut === 'string' && FORMAT_JOUR.test(brut) && !Number.isNaN(Date.parse(brut))) {
      valeurs.hintsAvailableFrom = brut;
    } else {
      return { valeurs, erreur: 'hintsAvailableFrom doit être une date au format AAAA-MM-JJ' };
    }
  }
  return { valeurs };
}
