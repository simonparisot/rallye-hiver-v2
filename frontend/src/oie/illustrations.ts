/**
 * Illustrations des cases du plateau, d'apres le guide des organisateurs
 * (statics/jeu-oie/guide.jpeg).
 *
 * Purement decoratives : elles ne disent rien que la couleur, le libelle et
 * l'info-bulle de la case ne disent deja. Elles vivent donc ici, cote
 * navigateur, et non dans la configuration du plateau.
 */

import acteur from './illustrations/acteur.jpg';
import actrice from './illustrations/actrice.jpg';
import cintres from './illustrations/cintres.jpg';
import compositeurVioloncelle from './illustrations/compositeur-violoncelle.jpg';
import loge from './illustrations/loge.jpg';
import lumieres from './illustrations/lumieres.jpg';
import maquillage from './illustrations/maquillage.jpg';
import musique from './illustrations/musique.jpg';
import offenbach from './illustrations/offenbach.jpg';
import oie from './illustrations/oie.jpg';
import opera from './illustrations/opera.jpg';
import pont from './illustrations/pont.jpg';
import prison from './illustrations/prison.jpg';
import public_ from './illustrations/public.jpg';
import puits from './illustrations/puits.jpg';
import repetition from './illustrations/repetition.jpg';
import script from './illustrations/script.jpg';
import souffleur from './illustrations/souffleur.jpg';
import troupe from './illustrations/troupe.jpg';

/** Case par case, dans l'ordre du guide. La case 0 n'a pas d'illustration. */
const PAR_CASE: Record<number, string> = {
  1: cintres,
  2: maquillage,
  3: script,
  4: acteur,
  5: script,
  6: pont,
  7: acteur,
  8: script,
  9: oie,
  10: acteur,
  11: opera,
  12: script,
  13: musique,
  14: souffleur,
  15: acteur,
  16: offenbach,
  17: opera,
  18: oie,
  19: loge,
  20: acteur,
  21: opera,
  22: acteur,
  23: pont,
  24: actrice,
  25: acteur,
  26: script,
  27: oie,
  28: acteur,
  29: script,
  30: offenbach,
  31: puits,
  32: script,
  33: offenbach,
  34: acteur,
  35: script,
  36: oie,
  37: musique,
  38: script,
  39: souffleur,
  40: public_,
  41: musique,
  42: acteur,
  43: offenbach,
  44: maquillage,
  45: oie,
  // Le guide dit « Puccini » : c'est le seul portrait isole fourni.
  46: compositeurVioloncelle,
  47: pont,
  48: actrice,
  49: public_,
  50: souffleur,
  51: troupe,
  52: prison,
  53: script,
  54: oie,
  55: script,
  56: public_,
  57: offenbach,
  58: repetition,
  59: script,
  60: souffleur,
  61: offenbach,
  62: lumieres,
  // Pas d'image « arrivée » fournie : la troupe qui salue est le rideau final.
  63: troupe,
};

/** Illustration d'une case, ou undefined si elle n'en a pas. */
export function illustrationDeCase(squareNumber: number): string | undefined {
  return PAR_CASE[squareNumber];
}
