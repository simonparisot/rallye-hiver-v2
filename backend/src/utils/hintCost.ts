/**
 * Coût d'un indice, en points. EN SOMMEIL.
 *
 * Le commanditaire veut d'abord savoir si le mécanisme de choix d'indice
 * fonctionne : facturer des points pendant l'essai brouillerait la seule
 * question qui compte, et retirerait des points à des équipes pour une
 * fonctionnalité qui peut encore être retirée. Aucun appelant n'utilise donc ces
 * fonctions aujourd'hui : `pointsCharged` vaut 0 dans toutes les demandes, et
 * `getStats` ne déduit rien.
 *
 * Le barème reste ici, écrit et testé, pour le jour où la décision sera prise.
 * Le rebrancher demande deux gestes, et rien d'autre :
 *   1. dans `functions/hints/requestHint.ts`, remplacer le 0 de `pointsCharged`
 *      par `nextHintCost(enigma.points, dejaDonnes.length)` ;
 *   2. dans `functions/teams/getStats.ts`, sommer `enigmaScoreAfterHints()`
 *      plutôt que `enigma.points`.
 * L'interface joueur devra alors réafficher le chiffre, qu'elle remplace
 * aujourd'hui par un avertissement sans montant.
 *
 * Règle écrite ici : chaque indice demandé coûte 25 % des points de l'énigme, de
 * manière cumulative (deux indices : 50 %), et le score d'une énigme ne descend
 * jamais sous zéro.
 */

/** Part des points de l'énigme prélevée par indice. */
export const HINT_COST_RATIO = 0.25;

/**
 * Pénalité totale supportée par une équipe sur une énigme après `hintsCount`
 * indices. Plafonnée aux points de l'énigme : le score plancher est zéro, on ne
 * retire jamais des points gagnés ailleurs.
 */
export function totalHintPenalty(enigmaPoints: number, hintsCount: number): number {
  if (!enigmaPoints || enigmaPoints <= 0 || hintsCount <= 0) {
    return 0;
  }
  const brut = Math.round(enigmaPoints * HINT_COST_RATIO * hintsCount);
  return Math.min(enigmaPoints, brut);
}

/**
 * Coût du prochain indice. C'est la différence entre la pénalité après et la
 * pénalité avant : une fois la pénalité plafonnée, les indices suivants sont
 * gratuits plutôt que de rendre le score négatif.
 */
export function nextHintCost(enigmaPoints: number, hintsAlreadyObtained: number): number {
  const avant = totalHintPenalty(enigmaPoints, hintsAlreadyObtained);
  const apres = totalHintPenalty(enigmaPoints, hintsAlreadyObtained + 1);
  return apres - avant;
}

/**
 * Points réellement acquis par une équipe sur une énigme résolue, indices
 * déduits. C'est la fonction qu'appelleraient tous les calculs de score le jour
 * où la pénalité est rebranchée.
 */
export function enigmaScoreAfterHints(enigmaPoints: number, hintsCount: number): number {
  return Math.max(0, (enigmaPoints || 0) - totalHintPenalty(enigmaPoints, hintsCount));
}
