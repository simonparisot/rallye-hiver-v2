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
  bonusRolls,
  canRoll,
  dayLabel,
  daysBetween,
  FINISH_SQUARE,
  initialTeamState,
  isAnswerCorrect,
  normalizeAnswer,
  parisDay,
  PUITS_SKIPPED_DAYS,
  pushedState,
  resolveMove,
  resolvePushChain,
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
    const move = resolveMove(20, 2, 0);
    expect(move.position).toBe(22);
    expect(move.inPuits).toBe(false);
    expect(move.inPrison).toBe(false);
    expect(move.skippedDays).toBe(0);
  });
});

describe('L\'acteur sur son oie', () => {
  test('on s\'arrete sur l\'oie et on gagne le droit de relancer', () => {
    // 4 depuis la case 5 : on arrive en 9, et c'est tout. Le relancer viendra
    // dans une autre requete, avec de nouveaux des.
    const move = resolveMove(5, 4, 0);
    expect(move.position).toBe(9);
    expect(move.bonusRoll).toBe(true);
    expect(move.effects).toEqual([
      { kind: 'avance', from: 5, to: 9 },
      { kind: 'oie', at: 9 },
    ]);
  });

  test('le meme total n\'est plus rejoue', () => {
    // L'ancienne regle menait en 13 d'un trait. Desormais on s'arrete en 9.
    expect(resolveMove(5, 4, 0).position).toBe(9);
    expect(resolveMove(1, 8, 0).position).toBe(9);
  });

  test('un neuf depuis la case 0 ne gagne plus la partie', () => {
    /**
     * C'etait le trou de la regle traditionnelle : en rejouant le meme total,
     * 0 enchainait 9, 18, 27, 36, 45, 54 puis 63, une fois sur neuf. On
     * s'arrete maintenant en 9, ce qui rend inutiles les destinations
     * arbitraires du premier neuf (26 et 53) : elles ont ete supprimees.
     */
    const move = resolveMove(0, 9, 0);
    expect(move.position).toBe(9);
    expect(move.finished).toBe(false);
    expect(move.bonusRoll).toBe(true);
  });

  test('aucune case oie ne mene plus a un enchainement', () => {
    [9, 18, 27, 36, 45, 54].forEach((oie) => {
      const move = resolveMove(oie - 2, 2, 0);
      expect(move.position).toBe(oie);
      expect(move.bonusRoll).toBe(true);
      expect(move.finished).toBe(false);
    });
  });

  test('reculer sur une oie en donne aussi le relancer', () => {
    // 50 + 17 est impossible aux des, mais 54 est atteignable par rebond :
    // 60 + 12 = 72, neuf de trop, retour en 54.
    const move = resolveMove(60, 12, 0);
    expect(move.position).toBe(54);
    expect(move.bonusRoll).toBe(true);
  });

  test('un lancer reste toujours sur le plateau', () => {
    for (let total = 2; total <= 12; total += 1) {
      for (let from = 0; from < FINISH_SQUARE; from += 1) {
        const move = resolveMove(from, total, 0);
        expect(move.position).toBeGreaterThanOrEqual(0);
        expect(move.position).toBeLessThanOrEqual(FINISH_SQUARE);
      }
    }
  });
});

describe('Les ponts', () => {
  test('les trois ponts sont a leur place', () => {
    [6, 23, 47].forEach((square) => expect(squareType(square)).toBe('pont'));
    [12, 30, 53].forEach((square) => expect(squareType(square)).toBe('normale'));
  });

  test('on traverse directement, sans s\'arreter sur le pont', () => {
    const move = resolveMove(2, 4, 0);
    expect(move.position).toBe(12);
    expect(move.effects).toEqual([
      { kind: 'avance', from: 2, to: 6 },
      { kind: 'pont', from: 6, to: 12 },
    ]);
  });

  test('chaque pont mene a sa case', () => {
    expect(resolveMove(20, 3, 0).position).toBe(30);
    expect(resolveMove(40, 7, 0).position).toBe(53);
  });

  test('passer par-dessus un pont sans s\'y arreter ne fait rien', () => {
    expect(resolveMove(4, 5, 0).position).toBe(9); // 6 est traverse, l'oie de 9 s'applique
    expect(resolveMove(20, 8, 0).position).toBe(28);
  });

  test('arriver par un pont sur une case occupee fait reculer l\'occupant de la case d\'en face', () => {
    // L'arrivee reelle est la case d'en face : c'est elle qui compte. Le pont
    // lui-meme, traverse, ne pousse personne.
    const move = resolveMove(2, 4, 0);
    const states = [
      { ...initialTeamState('moi', TODAY, NOW), position: 2 },
      { ...initialTeamState('surLePont', TODAY, NOW), position: 6 },
      { ...initialTeamState('autre', TODAY, NOW), position: 12 },
    ];
    expect(resolvePushChain(states, 'moi', 2, move.position)).toEqual([
      { teamId: 'autre', from: 12, to: 11, rang: 1, pushedBy: ['moi'] },
    ]);
  });
});

describe('Cases speciales', () => {
  test('la loge fait passer un tour', () => {
    const move = resolveMove(17, 2, 0);
    expect(move.position).toBe(19);
    expect(move.skippedDays).toBe(1);
    expect(move.inPrison).toBe(false);
  });

  test('le puits fait passer trois tours', () => {
    // Il retenait sans echeance, ce qui condamnait une equipe quand personne
    // ne venait tomber en 31. Il fonctionne maintenant comme la prison.
    const move = resolveMove(28, 3, 0);
    expect(move.position).toBe(31);
    expect(move.inPuits).toBe(true);
    expect(move.skippedDays).toBe(PUITS_SKIPPED_DAYS);
    expect(move.skippedDays).toBe(3);
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
    expect(move.effects[0]).toEqual({ kind: 'rebond', from: 61, to: 60, depassement: 3, manques: 1 });
  });

  test('chaque rebond compte comme un essai manque, et le dit', () => {
    // Ce qui a ete pris pour un bug : 61 + 7 mene au metteur en scene des le
    // premier essai depuis la 61. C'etait en fait le troisieme depassement,
    // les deux premiers ayant ete des rebonds plus tot dans la partie.
    const premier = resolveMove(60, 5, 0); // 65, retour en 61
    expect(premier.position).toBe(61);
    expect(premier.effects[0]).toMatchObject({ kind: 'rebond', manques: 1 });

    const second = resolveMove(61, 9, premier.overshootCount); // 70, retour en 56
    expect(second.position).toBe(56);
    expect(second.effects[0]).toMatchObject({ kind: 'rebond', manques: 2 });

    const troisieme = resolveMove(61, 7, second.overshootCount);
    expect(troisieme.position).toBe(FINISH_SQUARE);
    expect(troisieme.effects).toContainEqual({ kind: 'metteur_en_scene', from: 61, to: 63 });
  });

  test('sans depassement prealable, 61 + 7 recule et finit sur la repetition', () => {
    // 68, cinq de trop, retour en 58 : la repetition renvoie en case 0.
    const move = resolveMove(61, 7, 0);
    expect(move.finished).toBe(false);
    expect(move.position).toBe(0);
    expect(move.effects).toContainEqual({ kind: 'mort', from: 58, to: 0 });
  });

  test('les des eux-memes ne comptent pour rien, seul le total compte', () => {
    // 2 + 5 et 3 + 4 donnent exactement le meme deplacement.
    expect(resolveMove(57, 7, 0)).toEqual(resolveMove(57, 7, 0));
    expect(resolveMove(57, 7, 0).position).toBe(62);
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

  test('le puits retient trois jours, puis rend la main tout seul', () => {
    // Puits le 15 : nextRollAllowedDay = 19, donc rien avant, mais plus rien
    // non plus a attendre de la charite des autres equipes apres.
    const puits = state({ inPuits: true, nextRollAllowedDay: addDays(TODAY, 4) });
    expect(canRoll(puits, TODAY, 5)).toBe(false);
    expect(teamStatus(puits, TODAY, 5)).toBe('dans_le_puits');
    expect(canRoll(puits, addDays(TODAY, 3), 1)).toBe(false);
    expect(canRoll(puits, addDays(TODAY, 4), 1)).toBe(true);
    expect(rollRefusal(puits, TODAY, 1)).toMatch(/puits/i);
    expect(rollRefusal(puits, TODAY, 1)).toMatch(/repêche/i);
  });

  test('le puits retient un jour de plus que la prison', () => {
    const puits = resolveMove(28, 3, 0);
    const prison = resolveMove(48, 4, 0);
    expect(puits.skippedDays).toBe(prison.skippedDays + 1);
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

describe('Le lancer du a une oie', () => {
  test('une equipe neuve n\'en a aucun', () => {
    expect(bonusRolls(state())).toBe(0);
    expect(teamStatus(state(), TODAY, 1)).toBe('peut_lancer');
  });

  test('il passe outre le quota du jour', () => {
    const duParOie = state({ bonusRolls: 1, rollsUsedToday: 1, rollsDay: TODAY });
    expect(canRoll(duParOie, TODAY, 1)).toBe(true);
    expect(teamStatus(duParOie, TODAY, 1)).toBe('relance_oie');
    expect(rollsRemaining(duParOie, TODAY, 1)).toBe(0);
  });

  test('il passe outre une penalite en cours', () => {
    // Cas de principe : on ne peut pas etre sur une oie et puni en meme temps,
    // mais un lancer deja gagne ne doit jamais etre reprenable.
    const duParOie = state({ bonusRolls: 1, nextRollAllowedDay: addDays(TODAY, 3) });
    expect(canRoll(duParOie, TODAY, 1)).toBe(true);
  });

  test('la question de la case passe quand meme avant', () => {
    const duParOie = state({ bonusRolls: 1, questionPending: true });
    expect(canRoll(duParOie, TODAY, 1)).toBe(false);
    expect(teamStatus(duParOie, TODAY, 1)).toBe('question_en_attente');
  });

  test('une valeur negative stockee ne rend pas de lancer', () => {
    expect(bonusRolls(state({ bonusRolls: -3 }))).toBe(0);
    expect(canRoll(state({ bonusRolls: -3, rollsUsedToday: 1, rollsDay: TODAY }), TODAY, 1)).toBe(false);
  });
});

describe('Message des penalites', () => {
  test('le puits donne le jour de reprise, pas un compte de jours', () => {
    // Tombee le vendredi 15 janvier : trois tours, reprise le mardi 19.
    // L'ancien message annoncait « encore 4 jour(s) », lu comme un quatrieme tour.
    const puits = state({ inPuits: true, nextRollAllowedDay: addDays(TODAY, PUITS_SKIPPED_DAYS + 1) });
    const message = rollRefusal(puits, TODAY, 1) || '';
    expect(message).toContain('mardi 19 janvier');
    expect(message).not.toMatch(/\d+ jour/);
  });

  test('le libelle du jour ne depend pas du fuseau de la machine', () => {
    expect(dayLabel('2027-01-15')).toBe('vendredi 15 janvier');
    expect(dayLabel('2026-10-29')).toBe('jeudi 29 octobre');
  });
});

describe('La case occupee : recul d\'une case, en chaine', () => {
  const equipe = (teamId: string, position: number, overrides: Partial<OieTeamState> = {}) =>
    ({ ...initialTeamState(teamId, TODAY, NOW), position, ...overrides });

  test('A arrive sur B : B recule d\'une case', () => {
    const states = [equipe('A', 20), equipe('B', 25), equipe('loin', 40)];
    expect(resolvePushChain(states, 'A', 20, 25)).toEqual([
      { teamId: 'B', from: 25, to: 24, rang: 1, pushedBy: ['A'] },
    ]);
  });

  test('chaine A -> B -> C -> D : chacune recule d\'une case, dans l\'ordre', () => {
    const states = [equipe('A', 10), equipe('B', 30), equipe('C', 29), equipe('D', 28), equipe('E', 26)];
    expect(resolvePushChain(states, 'A', 10, 30)).toEqual([
      { teamId: 'B', from: 30, to: 29, rang: 1, pushedBy: ['A'] },
      { teamId: 'C', from: 29, to: 28, rang: 2, pushedBy: ['B'] },
      { teamId: 'D', from: 28, to: 27, rang: 3, pushedBy: ['C'] },
    ]);
    // E, en 26, n'est pas touchee : la case 27 etait libre.
  });

  test('plusieurs equipes sur la meme case reculent ensemble, et poussent ensemble', () => {
    const states = [equipe('A', 10), equipe('B1', 17), equipe('B2', 17), equipe('C', 16)];
    expect(resolvePushChain(states, 'A', 10, 17)).toEqual([
      { teamId: 'B1', from: 17, to: 16, rang: 1, pushedBy: ['A'] },
      { teamId: 'B2', from: 17, to: 16, rang: 1, pushedBy: ['A'] },
      { teamId: 'C', from: 16, to: 15, rang: 2, pushedBy: ['B1', 'B2'] },
    ]);
  });

  test('la chaine s\'arrete en case 0, partagee, et ne descend jamais dessous', () => {
    const states = [equipe('A', 0), equipe('B', 2), equipe('C', 1), equipe('Z', 0)];
    // A, partie de 0, arrive en 2 (un pont mis a part, la regle est la meme).
    const pushes = resolvePushChain(states, 'A', 0, 2);
    expect(pushes).toEqual([
      { teamId: 'B', from: 2, to: 1, rang: 1, pushedBy: ['A'] },
      { teamId: 'C', from: 1, to: 0, rang: 2, pushedBy: ['B'] },
    ]);
    // Z reste en 0 avec C : personne n'est pousse depuis la case 0.
    expect(pushes.every((push) => push.to >= 0)).toBe(true);
  });

  test('la chaine termine toujours : un plateau plein se vide jusqu\'a la case 0', () => {
    const states = [equipe('A', 50)];
    for (let square = 1; square <= 62; square += 1) states.push(equipe(`t${square}`, square));
    const pushes = resolvePushChain(states, 'A', 50, 62);
    expect(pushes).toHaveLength(62); // t62 .. t1, chacune une fois
    expect(new Set(pushes.map((push) => push.teamId)).size).toBe(62);
    expect(pushes[pushes.length - 1]).toMatchObject({ teamId: 't1', from: 1, to: 0, rang: 62 });
  });

  test('l\'arrivante n\'est jamais poussee par sa propre chaine', () => {
    // 61 + 3 = 64, un de trop, retour en 62 : l'arrivante vient de 61, juste
    // en dessous de la case ou elle pousse.
    expect(resolveMove(61, 3, 0).position).toBe(62);
    const states = [equipe('A', 61), equipe('B', 62)];
    expect(resolvePushChain(states, 'A', 61, 62)).toEqual([
      { teamId: 'B', from: 62, to: 61, rang: 1, pushedBy: ['A'] },
    ]);
  });

  test('case speciale ou non, l\'arrivee pousse partout', () => {
    // L'oie, le souffleur, la loge, le puits, la prison, la repetition.
    [9, 14, 19, 31, 52].forEach((caseOccupee) => {
      const states = [equipe('A', 3), equipe('B', caseOccupee)];
      expect(resolvePushChain(states, 'A', 3, caseOccupee)).toEqual([
        { teamId: 'B', from: caseOccupee, to: caseOccupee - 1, rang: 1, pushedBy: ['A'] },
      ]);
    });
  });

  test('cases exemptees : ni la case 0 ni la 63 ne poussent personne', () => {
    const depart = [equipe('A', 58), equipe('B', 0)];
    expect(resolvePushChain(depart, 'A', 55, 0)).toEqual([]);
    const arrivee = [equipe('A', 60), equipe('B', 63, { questionPending: true }), equipe('C', 62)];
    expect(resolvePushChain(arrivee, 'A', 60, 63)).toEqual([]);
  });

  test('un rebond qui ramene sur sa propre case ne pousse personne', () => {
    // 61 + 4 = 65, deux de trop, retour en 61.
    expect(resolveMove(61, 4, 0).position).toBe(61);
    const states = [equipe('A', 61), equipe('B', 61)];
    expect(resolvePushChain(states, 'A', 61, 61)).toEqual([]);
  });

  test('une equipe arrivee n\'est jamais poussee', () => {
    const states = [equipe('A', 50), equipe('gagnante', 55, { finishedAt: NOW })];
    expect(resolvePushChain(states, 'A', 50, 55)).toEqual([]);
  });

  test('arrivee par une oie : seule la case de l\'oie, finale, pousse', () => {
    const move = resolveMove(4, 5, 0); // 9, une oie : on y reste, avec un lancer du
    expect(move.position).toBe(9);
    expect(move.bonusRoll).toBe(true);
    const states = [equipe('A', 4), equipe('B', 9), equipe('C', 8)];
    expect(resolvePushChain(states, 'A', 4, move.position)).toEqual([
      { teamId: 'B', from: 9, to: 8, rang: 1, pushedBy: ['A'] },
      { teamId: 'C', from: 8, to: 7, rang: 2, pushedBy: ['B'] },
    ]);
  });

  test('arrivee par la repetition : retour en 0, personne n\'est pousse', () => {
    const move = resolveMove(50, 8, 0); // 58, la repetition, retour en 0
    expect(move.position).toBe(0);
    const states = [equipe('A', 50), equipe('B', 58), equipe('C', 0)];
    expect(resolvePushChain(states, 'A', 50, move.position)).toEqual([]);
  });

  test('arrivee en 63 : les equipes de la 62 ne sont pas poussees', () => {
    const move = resolveMove(55, 8, 0);
    expect(move.position).toBe(FINISH_SQUARE);
    const states = [equipe('A', 55), equipe('B', 63, { questionPending: true }), equipe('C', 62)];
    expect(resolvePushChain(states, 'A', 55, move.position)).toEqual([]);
  });

  test('l\'equipe qui recule doit repondre a la question de sa nouvelle case', () => {
    const avant = equipe('B', 25, { questionPending: false });
    const apres = pushedState(avant, 24, true, TODAY, NOW);
    expect(apres.position).toBe(24);
    expect(apres.questionPending).toBe(true);
    expect(pushedState(avant, 24, false, TODAY, NOW).questionPending).toBe(false);
  });

  test('reculer sur une case speciale n\'a aucun effet', () => {
    // Poussee de 32 sur le puits : elle n'y tombe pas.
    const puits = pushedState(equipe('B', 32), 31, true, TODAY, NOW);
    expect(puits.inPuits).toBe(false);
    expect(puits.nextRollAllowedDay).toBe(TODAY);
    // De 53 sur la prison : pas enfermee.
    expect(pushedState(equipe('B', 53), 52, true, TODAY, NOW).inPrison).toBe(false);
    // De 28 sur l'oie : pas de lancer offert.
    const oie = pushedState(equipe('B', 28), 27, false, TODAY, NOW);
    expect(oie.bonusRolls).toBe(0);
    expect(teamStatus(oie, TODAY, 1)).toBe('peut_lancer');
    // De 20 sur la loge : pas de tour passe.
    expect(rollRefusal(pushedState(equipe('B', 20), 19, false, TODAY, NOW), TODAY, 1)).toBeNull();
    // De 7 sur le pont : elle reste sur le pont, sans le traverser.
    expect(pushedState(equipe('B', 7), 6, false, TODAY, NOW).position).toBe(6);
    // De 59 sur la repetition : pas de retour en 0.
    expect(pushedState(equipe('B', 59), 58, false, TODAY, NOW).position).toBe(58);
  });

  test('tiree du puits par le recul, elle est libre aussitot', () => {
    const auFond = equipe('B', 31, { inPuits: true, nextRollAllowedDay: addDays(TODAY, PUITS_SKIPPED_DAYS + 1) });
    const libre = pushedState(auFond, 30, true, TODAY, NOW);
    expect(libre.position).toBe(30);
    expect(libre.inPuits).toBe(false);
    expect(libre.nextRollAllowedDay).toBe(TODAY);
    expect(rollRefusal({ ...libre, questionPending: false }, TODAY, 1)).toBeNull();
  });

  test('sortie de prison par le recul, elle est libre aussitot', () => {
    const enfermee = equipe('B', 52, { inPrison: true, nextRollAllowedDay: addDays(TODAY, 3) });
    const libre = pushedState(enfermee, 51, false, TODAY, NOW);
    expect(libre.inPrison).toBe(false);
    expect(rollRefusal(libre, TODAY, 1)).toBeNull();
  });

  test('quitter une oie fait perdre le lancer qu\'elle devait', () => {
    const surOie = equipe('B', 18, { bonusRolls: 1 });
    expect(pushedState(surOie, 17, true, TODAY, NOW).bonusRolls).toBe(0);
  });

  test('le quota, les compteurs et les essais manques ne bougent pas', () => {
    const avant = equipe('B', 40, { rollsUsedToday: 1, totalRolls: 7, wrongAnswers: 2, overshootCount: 1, hintedSquares: [14] });
    const apres = pushedState(avant, 39, true, TODAY, NOW);
    expect(apres).toMatchObject({ rollsUsedToday: 1, totalRolls: 7, wrongAnswers: 2, overshootCount: 1, hintedSquares: [14], version: avant.version });
  });

  test('une equipe poussee sur le puits occupe en tire l\'occupante, sans y tomber', () => {
    const states = [equipe('A', 25), equipe('B', 32), equipe('C', 31, { inPuits: true })];
    expect(resolvePushChain(states, 'A', 25, 32)).toEqual([
      { teamId: 'B', from: 32, to: 31, rang: 1, pushedBy: ['A'] },
      { teamId: 'C', from: 31, to: 30, rang: 2, pushedBy: ['B'] },
    ]);
  });
});

describe('La question finale de la case 63', () => {
  test('arriver en 63 n\'est plus gagner', () => {
    const en63 = state({ position: FINISH_SQUARE, questionPending: true });
    expect(en63.finishedAt).toBeUndefined();
    expect(teamStatus(en63, TODAY, 1)).toBe('question_finale');
    expect(canRoll(en63, TODAY, 1)).toBe(false);
    expect(rollRefusal(en63, TODAY, 1)).toMatch(/finale/i);
  });

  test('une question ordinaire ailleurs reste une question ordinaire', () => {
    const ailleurs = state({ position: 31, questionPending: true });
    expect(teamStatus(ailleurs, TODAY, 1)).toBe('question_en_attente');
    expect(rollRefusal(ailleurs, TODAY, 1)).not.toMatch(/finale/i);
  });

  test('la reponse donnee, l\'equipe a gagne et ne joue plus', () => {
    const gagnante = state({
      position: FINISH_SQUARE,
      questionPending: false,
      finishedAt: NOW,
      finishRank: 1,
    });
    expect(teamStatus(gagnante, TODAY, 1)).toBe('arrivee');
    expect(rollRefusal(gagnante, TODAY, 1)).toMatch(/remporté/i);
  });

  test('un lancer du par une oie ne survit pas a l\'arrivee', () => {
    // roll.ts remet le compteur a zero en 63 : la verification porte ici sur
    // le fait qu'une equipe gagnante ne lance plus, quoi qu'on lui doive.
    const gagnante = state({ position: FINISH_SQUARE, bonusRolls: 1, finishedAt: NOW });
    expect(canRoll(gagnante, TODAY, 1)).toBe(false);
  });
});
