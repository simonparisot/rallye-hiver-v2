/**
 * Tests du handler POST /oie/roll, la couche DynamoDB remplacee par des faux :
 * on verifie ce qui est ecrit (l'equipe qui lance, puis toute la chaine de
 * recul en une seule ecriture groupee) et ce qui est journalise.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../store', () => {
  class OieConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'OieConflictError';
    }
  }
  return {
    OieConflictError,
    getBoard: jest.fn(),
    getTeamState: jest.fn(),
    getAllTeamStates: jest.fn(),
    putTeamState: jest.fn(),
    putTeamStates: jest.fn(),
    logEvent: jest.fn(),
  };
});

jest.mock('../view', () => ({
  buildBoardView: jest.fn(),
  getTeamNames: jest.fn(),
}));

jest.mock('../finish', () => ({
  finishRankAmong: jest.fn(() => 1),
  markEnigmaSolved: jest.fn(),
}));

jest.mock('../context', () => ({
  ...jest.requireActual('../context'),
  requirePlayer: jest.fn(),
}));

import * as store from '../store';
import * as view from '../view';
import * as context from '../context';
import { handler } from '../roll';
import { emptySquare, initialTeamState, parisDay } from '../rules';
import { OieTeamState } from '../../../types/oie';

const evenement = { requestContext: { authorizer: { userId: 'u1' } } } as unknown as APIGatewayProxyEvent;

const NOMS: Record<string, string> = { A: 'Les Arlequins', B: 'Les Bouffons', C: 'Les Coryphées', D: 'Les Doublures' };

function equipe(teamId: string, position: number, overrides: Partial<OieTeamState> = {}): OieTeamState {
  const today = parisDay(new Date());
  return { ...initialTeamState(teamId, today, '2027-01-15T10:00:00.000Z'), position, version: 4, ...overrides };
}

/** Des truques : chaque valeur de Math.random donne un de (0.2 -> 2, 0.4 -> 3). */
function des(premier: number, second: number) {
  const valeurs = [(premier - 1) / 6 + 0.01, (second - 1) / 6 + 0.01];
  jest.spyOn(Math, 'random').mockImplementation(() => valeurs.shift() ?? 0);
}

function plateau() {
  const squares = [];
  for (let n = 0; n <= 63; n += 1) squares.push(emptySquare(n));
  // Seules 24 et 63 portent une question : 23 n'en a pas.
  squares[24] = { ...squares[24], question: 'Qui ?', acceptedAnswers: ['moi'] };
  squares[63] = { ...squares[63], question: 'Fin ?', acceptedAnswers: ['fin'] };
  return { boardId: 'default', squares, rollsPerDay: 1, updatedAt: '' };
}

function decor(states: OieTeamState[]) {
  (context.requirePlayer as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 'A', teamName: NOMS.A });
  (store.getBoard as jest.Mock).mockResolvedValue(plateau());
  (store.getTeamState as jest.Mock).mockResolvedValue(states.find((s) => s.teamId === 'A'));
  (store.getAllTeamStates as jest.Mock).mockResolvedValue(states);
  (store.putTeamState as jest.Mock).mockImplementation(async (next) => next);
  (store.putTeamStates as jest.Mock).mockImplementation(async (changes) => changes.map((c: any) => c.next));
  (store.logEvent as jest.Mock).mockResolvedValue({});
  (view.buildBoardView as jest.Mock).mockResolvedValue({});
  (view.getTeamNames as jest.Mock).mockResolvedValue(
    new Map(Object.entries(NOMS).map(([teamId, teamName]) => [teamId, { teamName, isTest: false }]))
  );
}

afterEach(() => jest.restoreAllMocks());

describe('POST /oie/roll, case occupee', () => {
  test('A arrive sur B en 25 : B, puis C et D reculent en chaine, ecrits en une seule fois', async () => {
    const states = [
      equipe('A', 20),
      equipe('B', 25, { bonusRolls: 0 }),
      equipe('C', 24, { questionPending: true }),
      equipe('D', 23, { version: 9 }),
    ];
    decor(states);
    des(2, 3); // 20 + 5 = 25

    const reponse = await handler(evenement);
    expect(reponse.statusCode).toBe(200);
    const corps = JSON.parse(reponse.body);
    expect(corps.to).toBe(25);

    // L'equipe qui lance est ecrite d'abord, seule, sous sa version.
    expect(store.putTeamState).toHaveBeenCalledTimes(1);
    expect((store.putTeamState as jest.Mock).mock.calls[0][0]).toMatchObject({ teamId: 'A', position: 25 });

    // Puis toute la chaine, en un seul appel (une transaction).
    expect(store.putTeamStates).toHaveBeenCalledTimes(1);
    const changes = (store.putTeamStates as jest.Mock).mock.calls[0][0];
    expect(changes.map((c: any) => [c.next.teamId, c.next.position, c.expectedVersion])).toEqual([
      ['B', 24, 4],
      ['C', 23, 4],
      ['D', 22, 9],
    ]);
    // Question de la nouvelle case : 24 en a une, 23 et 22 non.
    expect(changes.map((c: any) => c.next.questionPending)).toEqual([true, false, false]);

    // Un evenement par recul, dans l'ordre, avec qui pousse qui et le rang.
    const reculs = (store.logEvent as jest.Mock).mock.calls
      .map((call) => call[0])
      .filter((e) => e.detail?.kind === 'recul');
    expect(reculs.map((e) => [e.type, e.teamId, e.detail.pushedBy, e.detail.from, e.detail.to, e.detail.rang])).toEqual([
      ['deplacement', 'B', ['A'], 25, 24, 1],
      ['deplacement', 'C', ['B'], 24, 23, 2],
      ['deplacement', 'D', ['C'], 23, 22, 3],
    ]);
    expect(reculs.every((e) => e.detail.dislodgedBy === 'A')).toBe(true);
    expect(reculs[0].message).toBe('Les Arlequins arrive en case 25 : Les Bouffons recule en case 24');
    expect(reculs[2].message).toBe('Les Coryphées arrive en case 23 : Les Doublures recule en case 22 (recul en chaîne n° 3)');

    // Les horodatages suivent l'ordre de la chaine, et la reponse les raconte.
    const horaires = reculs.map((e) => e.occurredAt);
    expect([...horaires].sort()).toEqual(horaires);
    expect(corps.releases).toEqual(reculs.map((e) => e.message));
  });

  test('case libre : aucune ecriture groupee, aucun recul journalise', async () => {
    decor([equipe('A', 20), equipe('B', 26)]);
    des(2, 3);
    const reponse = await handler(evenement);
    expect(reponse.statusCode).toBe(200);
    expect(store.putTeamStates).not.toHaveBeenCalled();
    expect(JSON.parse(reponse.body).releases).toEqual([]);
  });

  test('tiree de la prison par le recul : evenement de liberation', async () => {
    const states = [equipe('A', 45), equipe('B', 52, { inPrison: true, nextRollAllowedDay: '2099-01-01' })];
    decor(states);
    des(3, 4); // 45 + 7 = 52, la prison
    const reponse = await handler(evenement);
    expect(reponse.statusCode).toBe(200);
    const changes = (store.putTeamStates as jest.Mock).mock.calls[0][0];
    expect(changes[0].next).toMatchObject({ teamId: 'B', position: 51, inPrison: false });
    const recul = (store.logEvent as jest.Mock).mock.calls.map((c) => c[0]).find((e) => e.detail?.kind === 'recul');
    expect(recul.type).toBe('liberation');
    expect(recul.message).toBe('Les Arlequins prend la place de Les Bouffons en prison : Les Bouffons sort et recule en case 51');
  });

  test('conflit : le plateau est relu (lecture coherente) et la chaine recalculee', async () => {
    const avant = [equipe('A', 20), equipe('B', 25), equipe('C', 24)];
    decor(avant);
    // Entre-temps, C a quitte la case 24 : seule B doit reculer.
    const apres = [equipe('A', 25, { version: 5 }), equipe('B', 25, { version: 5 }), equipe('C', 30, { version: 5 })];
    (store.getAllTeamStates as jest.Mock).mockResolvedValueOnce(avant).mockResolvedValueOnce(apres);
    (store.putTeamStates as jest.Mock)
      .mockRejectedValueOnce(new store.OieConflictError('conflit'))
      .mockImplementationOnce(async (changes) => changes.map((c: any) => c.next));
    des(2, 3);

    const reponse = await handler(evenement);
    expect(reponse.statusCode).toBe(200);
    expect(store.getAllTeamStates).toHaveBeenLastCalledWith(true);
    expect(store.putTeamStates).toHaveBeenCalledTimes(2);
    const second = (store.putTeamStates as jest.Mock).mock.calls[1][0];
    expect(second.map((c: any) => [c.next.teamId, c.next.position, c.expectedVersion])).toEqual([['B', 24, 5]]);
  });

  test('conflits repetes : le lancer reste valide, la chaine est abandonnee et tracee', async () => {
    decor([equipe('A', 20), equipe('B', 25)]);
    (store.putTeamStates as jest.Mock).mockRejectedValue(new store.OieConflictError('conflit'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    des(2, 3);

    const reponse = await handler(evenement);
    expect(reponse.statusCode).toBe(200);
    expect(store.putTeamStates).toHaveBeenCalledTimes(3);
    expect(JSON.parse(reponse.body).releases).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
