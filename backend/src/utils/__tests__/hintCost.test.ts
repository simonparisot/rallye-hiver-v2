import {
  HINT_COST_RATIO,
  totalHintPenalty,
  nextHintCost,
  enigmaScoreAfterHints,
} from '../hintCost';

describe('regle de cout des indices', () => {
  it('ne prend rien tant qu\'aucun indice n\'a ete demande', () => {
    expect(totalHintPenalty(20, 0)).toBe(0);
    expect(enigmaScoreAfterHints(20, 0)).toBe(20);
  });

  it('preleve 25 % des points par indice, de facon cumulative', () => {
    expect(HINT_COST_RATIO).toBe(0.25);
    expect(totalHintPenalty(20, 1)).toBe(5);
    expect(totalHintPenalty(20, 2)).toBe(10);
    expect(totalHintPenalty(20, 3)).toBe(15);
    expect(enigmaScoreAfterHints(20, 2)).toBe(10);
  });

  it('ne fait jamais descendre le score d\'une enigme sous zero', () => {
    expect(totalHintPenalty(20, 4)).toBe(20);
    expect(totalHintPenalty(20, 9)).toBe(20);
    expect(enigmaScoreAfterHints(20, 9)).toBe(0);
  });

  it('annonce le cout du prochain indice, nul une fois le plafond atteint', () => {
    expect(nextHintCost(20, 0)).toBe(5);
    expect(nextHintCost(20, 3)).toBe(5);
    // Le quatrieme indice epuise les points ; le cinquieme ne coute plus rien.
    expect(nextHintCost(20, 4)).toBe(0);
  });

  it('tient debout sur un nombre de points qui ne tombe pas juste', () => {
    // 15 points : 25 % valent 3,75, arrondis a 4.
    expect(totalHintPenalty(15, 1)).toBe(4);
    expect(totalHintPenalty(15, 2)).toBe(8);
    // La somme des couts annonces egale toujours la penalite totale.
    const couts = [0, 1, 2, 3].map((n) => nextHintCost(15, n));
    expect(couts.reduce((a, b) => a + b, 0)).toBe(totalHintPenalty(15, 4));
  });

  it('reste neutre sur une enigme sans points', () => {
    expect(totalHintPenalty(0, 3)).toBe(0);
    expect(nextHintCost(0, 0)).toBe(0);
    expect(enigmaScoreAfterHints(0, 3)).toBe(0);
  });
});
