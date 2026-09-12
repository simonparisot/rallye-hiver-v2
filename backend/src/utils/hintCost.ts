/**
 * Cout d'un indice, en points.
 *
 * Tout le bareme tient ici : la specification ne fixait pas de valeur, la regle
 * retenue est donc volontairement isolee dans un seul fichier pour qu'un
 * changement d'avis du commanditaire ne se traduise que par une ligne modifiee.
 *
 * Regle par defaut : chaque indice demande coute 25 % des points de l'enigme,
 * de maniere cumulative (deux indices : 50 %), et le score d'une enigme ne
 * descend jamais sous zero.
 */

/** Part des points de l'enigme prelevee par indice. */
export const HINT_COST_RATIO = 0.25;

/**
 * Penalite totale supportee par une equipe sur une enigme apres `hintsCount`
 * indices. Plafonnee aux points de l'enigme : le score plancher est zero, on ne
 * retire jamais des points gagnes ailleurs.
 */
export function totalHintPenalty(enigmaPoints: number, hintsCount: number): number {
  if (!enigmaPoints || enigmaPoints <= 0 || hintsCount <= 0) {
    return 0;
  }
  const brut = Math.round(enigmaPoints * HINT_COST_RATIO * hintsCount);
  return Math.min(enigmaPoints, brut);
}

/**
 * Cout du prochain indice, annonce a l'equipe avant qu'elle confirme puis
 * enregistre dans la demande. C'est la difference entre la penalite apres et la
 * penalite avant : une fois la penalite plafonnee, les indices suivants sont
 * gratuits plutot que de rendre le score negatif.
 */
export function nextHintCost(enigmaPoints: number, hintsAlreadyObtained: number): number {
  const avant = totalHintPenalty(enigmaPoints, hintsAlreadyObtained);
  const apres = totalHintPenalty(enigmaPoints, hintsAlreadyObtained + 1);
  return apres - avant;
}

/**
 * Points reellement acquis par une equipe sur une enigme resolue, indices
 * deduits. C'est la fonction que doivent appeler tous les calculs de score.
 */
export function enigmaScoreAfterHints(enigmaPoints: number, hintsCount: number): number {
  return Math.max(0, (enigmaPoints || 0) - totalHintPenalty(enigmaPoints, hintsCount));
}
