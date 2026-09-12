/**
 * Tests unitaires de la machine a etats du jeu de l'oie.
 *
 * Tout ce qui est teste ici est pur : aucun appel AWS, et l'horloge comme le
 * generateur aleatoire sont fournis par le test. C'est la seule facon de
 * verifier le changement de jour a Paris et la troisieme tentative ratee du 63
 * sans attendre trois jours.
 */

import {
  addDays,
  canRoll,
  daysBetween,
  FINISH_SQUARE,
  initialTeamState,
  isAnswerCorrect,
  normalizeAnswer,
  parisDay,
  PREMIER_NEUF_5_4,
  PREMIER_NEUF_6_3,
  resolveMove,
  rollDice,
  rollRefusal,
  rollsRemaining,
  squareType,
  teamStatus,
} from '../rules';
import { OieTeamState } from '../../../types/oie';

const TODAY = '2027-01-15';
const NOW = '2027-01-15T10:00:00.000Z';

function state(overrides: Partial<OieTeamState> = {}): OieTeamState {
  return { ...initialTeamState('equipe-1', TODAY, NOW), ...overrides };
}

describe('Nature des cases', () => {
  test('les cases de l\'oie sont toutes les 9 cases', () => {
    [9, 18, 27, 36, 45, 54].forEach((square) => expect(squareType(square)).toBe('oie'));
  });

  test('les cases speciales du theatre sont a leur place', () => {
    expect(squareType(0)).toBe('depart');
    expect(squareType(19)).toBe('loge');
    expect(squareType(31)).toBe('puits');
    expect(squareType(52)).toBe('prison');
    expect(squareType(58)).toBe('mort');
    expect(squareType(63)).toBe('arrivee');
    [14, 39, 50, 60].forEach((square) => expect(squareType(square)).toBe('souffleur'));
  });

  test('toute autre case est ordinaire', () => {
    expect(squareType(1)).toBe('normale');
    expect(squareType(62)).toBe('normale');
  });
});

describe('Deplacement simple', () => {
  test('avance de la somme des deux des', () => {
    const move = resolveMove(0, 7, 0);
    expect(move.position).toBe(7);
    expect(move.finished).toBe(false);
    expect(move.effects).toEqual([{ kind: 'avance', from: 0, to: 7 }]);
  });

  test('une case ordinaire n\'entraine aucun effet special', () => {
    const move = resolveMove(20, 3, 0);
    expect(move.position).toBe(23);
    expect(move.inPuits).toBe(false);
    expect(move.inPrison).toBe(false);
    expect(move.skippedDays).toBe(0);
  });
});

describe('L\'acteur sur son oie', () => {
  test('rejoue du meme total sans consommer de lancer', () => {
    // 5 + 4 = 9 depuis la case 9 : on arrive en 18, oie aussi, donc on continue.
    const move = resolveMove(5, 4, 0);
    expect(move.position).toBe(13);
    expect(move.effects).toEqual([
      { kind: 'avance', from: 5, to: 9 },
      { kind: 'oie', at: 9, total: 4 },
      { kind: 'avance', from: 9, to: 13 },
    ]);
  });

  test('enchaine les cases oie tant qu\'elles se suivent', () => {
    // Depuis 1 avec un total de 8 : 9, puis 17. Une seule oie traversee.
    const move = resolveMove(1, 8, 0);
    expect(move.position).toBe(17);
    expect(move.effects.filter((effect) => effect.kind === 'oie')).toHaveLength(1);
  });

  test('enchaine plusieurs oies d\'affilee', () => {
    // Depuis 45 avec un total de 9 : 54, puis 63 pile. Deux cases oie possibles
    // sur le trajet, la seconde etant l'arrivee.
    const move = resolveMove(45, 9, 0);
    expect(move.position).toBe(FINISH_SQUARE);
    expect(move.finished).toBe(true);
    expect(move.effects.filter((effect) => effect.kind === 'oie')).toHaveLength(1);
  });

  test('l\'enchainement se termine toujours', () => {
    for (let total = 2; total <= 12; total += 1) {
      for (let from = 0; from < FINISH_SQUARE; from += 1) {
        const move = resolveMove(from, total, 0);
        expect(move.position).toBeGreaterThanOrEqual(0);
        expect(move.position).toBeLessThanOrEqual(FINISH_SQUARE);
      }
    }
  });
});

describe('Exception du premier neuf', () => {
  /**
   * Sans elle, un 9 depuis la case 0 enchaine 9, 18, 27, 36, 45, 54, 63 et
   * gagne la partie du premier coup. Le cas s'est produit au premier essai sur
   * le bac a sable : des 4 et 5, arrivee immediate en 63.
   */
  test('un 6 et un 3 mene en case 26, sans enchainement', () => {
    const move = resolveMove(0, 9, 0, [6, 3]);
    expect(move.position).toBe(PREMIER_NEUF_6_3);
    expect(move.finished).toBe(false);
    expect(move.effects.some((effect) => effect.kind === 'oie')).toBe(false);
  });

  test('un 3 et un 6 mene aussi en case 26', () => {
    expect(resolveMove(0, 9, 0, [3, 6]).position).toBe(PREMIER_NEUF_6_3);
  });

  test('un 5 et un 4 mene en case 53', () => {
    expect(resolveMove(0, 9, 0, [5, 4]).position).toBe(PREMIER_NEUF_5_4);
    expect(resolveMove(0, 9, 0, [4, 5]).position).toBe(PREMIER_NEUF_5_4);
  });

  test('l\'exception est attachee a la case 0, pas au nombre de lancers', () => {
    // Revenir en case 0 par la mort ne doit pas rouvrir le raccourci.
    expect(resolveMove(0, 9, 0, [4, 5]).finished).toBe(false);
  });

  test('elle ne vaut que pour un total de neuf', () => {
    expect(resolveMove(0, 8, 0, [4, 4]).position).toBe(8);
    expect(resolveMove(0, 10, 0, [5, 5]).position).toBe(10);
  });

  test('ailleurs qu\'en case 0, un neuf se joue normalement', () => {
    const move = resolveMove(4, 9, 0, [4, 5]);
    expect(move.position).toBe(13);
  });
});

describe('Cases speciales', () => {
  test('la loge fait passer un tour', () => {
    const move = resolveMove(17, 2, 0);
    expect(move.position).toBe(19);
    expect(move.skippedDays).toBe(1);
    expect(move.inPrison).toBe(false);
  });

  test('le puits retient l\'equipe', () => {
    const move = resolveMove(28, 3, 0);
    expect(move.position).toBe(31);
    expect(move.inPuits).toBe(true);
    expect(move.skippedDays).toBe(0);
  });

  test('la prison fait passer deux tours', () => {
    const move = resolveMove(48, 4, 0);
    expect(move.position).toBe(52);
    expect(move.inPrison).toBe(true);
    expect(move.skippedDays).toBe(2);
  });

  test('la repetition ramene a la case 0', () => {
    const move = resolveMove(55, 3, 0);
    expect(move.position).toBe(0);
    expect(move.effects).toContainEqual({ kind: 'mort', from: 58, to: 0 });
  });

  test('la case du souffleur est signalee', () => {
    const move = resolveMove(11, 3, 0);
    expect(move.position).toBe(14);
    expect(move.effects).toContainEqual({ kind: 'souffleur', at: 14 });
  });
});

describe('Arrivee en case 63', () => {
  test('tomber pile termine la partie', () => {
    const move = resolveMove(60, 3, 0);
    expect(move.position).toBe(FINISH_SQUARE);
    expect(move.finished).toBe(true);
    expect(move.overshootCount).toBe(0);
  });

  test('un depassement fait reculer de l\'excedent', () => {
    // 61 + 5 = 66, soit 3 de trop : on recule de 3 depuis 63, donc 60.
    const move = resolveMove(61, 5, 0);
    expect(move.position).toBe(60);
    expect(move.finished).toBe(false);
    expect(move.overshootCount).toBe(1);
    expect(move.effects[0]).toEqual({ kind: 'rebond', from: 61, to: 60, depassement: 3 });
  });

  test('le rebond applique les regles de la case d\'arrivee', () => {
    // 59 + 5 = 64, un de trop : retour en 62. Rien de special en 62.
    expect(resolveMove(59, 5, 0).position).toBe(62);
    // 57 + 9 = 66, trois de trop : retour en 60, case du souffleur.
    const versSouffleur = resolveMove(57, 9, 0);
    expect(versSouffleur.position).toBe(60);
    expect(versSouffleur.effects).toContainEqual({ kind: 'souffleur', at: 60 });
  });

  test('au troisieme echec le metteur en scene place l\'equipe en 63', () => {
    const move = resolveMove(61, 5, 2);
    expect(move.position).toBe(FINISH_SQUARE);
    expect(move.finished).toBe(true);
    expect(move.overshootCount).toBe(3);
    expect(move.effects).toContainEqual({ kind: 'metteur_en_scene', from: 61, to: 63 });
  });

  test('les deux premiers echecs ne declenchent pas le metteur en scene', () => {
    expect(resolveMove(61, 5, 0).finished).toBe(false);
    expect(resolveMove(61, 5, 1).finished).toBe(false);
  });
});

describe('Les des', () => {
  test('deux des a six faces', () => {
    const valeurs = [0, 0.999];
    let index = 0;
    expect(rollDice(() => valeurs[index++])).toEqual([1, 6]);
  });

  test('reste toujours entre 2 et 12', () => {
    for (let i = 0; i < 500; i += 1) {
      const [a, b] = rollDice();
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(6);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
    }
  });
});

describe('Normalisation des reponses', () => {
  test('insensible a la casse, aux accents et a la ponctuation', () => {
    expect(normalizeAnswer('Molière !')).toBe('moliere');
    expect(normalizeAnswer('  LE  Cid  ')).toBe('lecid');
    expect(normalizeAnswer('Cœur')).toBe('coeur');
  });

  test('accepte n\'importe laquelle des reponses prevues', () => {
    expect(isAnswerCorrect('moliere', ['Molière', 'Jean-Baptiste Poquelin'])).toBe(true);
    expect(isAnswerCorrect('jean baptiste poquelin', ['Molière', 'Jean-Baptiste Poquelin'])).toBe(true);
    expect(isAnswerCorrect('racine', ['Molière'])).toBe(false);
  });

  test('une reponse vide est fausse', () => {
    expect(isAnswerCorrect('   ', ['Molière'])).toBe(false);
    expect(isAnswerCorrect('!!!', ['Molière'])).toBe(false);
  });
});

describe('Journee de jeu a Paris', () => {
  test('minuit a Paris fait changer de journee, pas minuit UTC', () => {
    // En hiver Paris est a UTC+1 : 23h00 UTC le 14 est deja le 15 a Paris.
    expect(parisDay(new Date('2027-01-14T23:00:00Z'))).toBe('2027-01-15');
    expect(parisDay(new Date('2027-01-14T22:59:00Z'))).toBe('2027-01-14');
  });

  test('l\'heure d\'ete est prise en compte', () => {
    // En ete Paris est a UTC+2 : 22h00 UTC le 14 juillet est deja le 15.
    expect(parisDay(new Date('2027-07-14T22:00:00Z'))).toBe('2027-07-15');
    expect(parisDay(new Date('2027-07-14T21:59:00Z'))).toBe('2027-07-14');
  });

  test('l\'arithmetique des jours traverse les mois et le changement d\'heure', () => {
    expect(addDays('2027-01-31', 1)).toBe('2027-02-01');
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29');
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(daysBetween('2027-01-15', '2027-01-18')).toBe(3);
    expect(daysBetween('2027-01-18', '2027-01-15')).toBe(-3);
  });
});

describe('Quota quotidien', () => {
  test('une equipe neuve peut lancer', () => {
    expect(canRoll(state(), TODAY, 1)).toBe(true);
    expect(teamStatus(state(), TODAY, 1)).toBe('peut_lancer');
  });

  test('le quota epuise interdit un nouveau lancer le meme jour', () => {
    const apresLancer = state({ rollsUsedToday: 1, rollsDay: TODAY });
    expect(canRoll(apresLancer, TODAY, 1)).toBe(false);
    expect(teamStatus(apresLancer, TODAY, 1)).toBe('quota_epuise');
    expect(rollsRemaining(apresLancer, TODAY, 1)).toBe(0);
  });

  test('le compteur repart a zero le lendemain', () => {
    const apresLancer = state({ rollsUsedToday: 1, rollsDay: TODAY });
    const demain = addDays(TODAY, 1);
    expect(canRoll(apresLancer, demain, 1)).toBe(true);
    expect(rollsRemaining(apresLancer, demain, 1)).toBe(1);
  });

  test('augmenter le quota libere immediatement des lancers', () => {
    const apresLancer = state({ rollsUsedToday: 1, rollsDay: TODAY });
    expect(canRoll(apresLancer, TODAY, 3)).toBe(true);
    expect(rollsRemaining(apresLancer, TODAY, 3)).toBe(2);
  });
});

describe('Ce qui empeche de lancer', () => {
  test('une question en attente bloque le lancer', () => {
    const attente = state({ questionPending: true });
    expect(canRoll(attente, TODAY, 1)).toBe(false);
    expect(teamStatus(attente, TODAY, 1)).toBe('question_en_attente');
    expect(rollRefusal(attente, TODAY, 1)).toMatch(/question/i);
  });

  test('le puits bloque le lancer meme avec du quota', () => {
    const puits = state({ inPuits: true });
    expect(canRoll(puits, TODAY, 5)).toBe(false);
    expect(teamStatus(puits, TODAY, 5)).toBe('dans_le_puits');
  });

  test('une equipe qui passe un tour attend le jour dit', () => {
    // Loge le 15 : nextRollAllowedDay = 17, donc rien le 15 ni le 16.
    const loge = state({ nextRollAllowedDay: addDays(TODAY, 2) });
    expect(canRoll(loge, TODAY, 1)).toBe(false);
    expect(canRoll(loge, addDays(TODAY, 1), 1)).toBe(false);
    expect(canRoll(loge, addDays(TODAY, 2), 1)).toBe(true);
    expect(teamStatus(loge, TODAY, 1)).toBe('tour_passe');
  });

  test('la prison retient deux jours de plus que la loge', () => {
    const prison = state({ inPrison: true, nextRollAllowedDay: addDays(TODAY, 3) });
    expect(canRoll(prison, addDays(TODAY, 2), 1)).toBe(false);
    expect(canRoll(prison, addDays(TODAY, 3), 1)).toBe(true);
    expect(rollRefusal(prison, TODAY, 1)).toMatch(/prison/i);
  });

  test('liberer une equipe lui rend le droit de lancer le jour meme', () => {
    // C'est ce que fait releaseTeam : inPuits a faux, nextRollAllowedDay a aujourd'hui.
    const libere = state({ inPuits: false, nextRollAllowedDay: TODAY });
    expect(canRoll(libere, TODAY, 1)).toBe(true);
  });

  test('une equipe arrivee ne lance plus', () => {
    const arrivee = state({ position: 63, finishedAt: NOW, finishRank: 1 });
    expect(canRoll(arrivee, TODAY, 1)).toBe(false);
    expect(teamStatus(arrivee, TODAY, 1)).toBe('arrivee');
  });

  test('la question passe avant le quota dans le message de refus', () => {
    const bloque = state({ questionPending: true, rollsUsedToday: 1, rollsDay: TODAY });
    expect(rollRefusal(bloque, TODAY, 1)).toMatch(/question/i);
  });
});
