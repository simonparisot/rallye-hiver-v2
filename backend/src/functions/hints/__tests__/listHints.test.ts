import { APIGatewayProxyEvent } from 'aws-lambda';

// La couche DynamoDB est entièrement remplacée : aucun service n'est appelé.
jest.mock('../../../utils/dynamodb', () => ({
  // Jeu lancé : la phase (utils/gamePhase) n'est pas le sujet de ces tests.
  getGameStatus: jest.fn(async () => ({ gameId: 'rallye-2025', isStarted: true })),
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
  getEnigmaById: jest.fn(),
  getHintRequestsByTeamAndEnigma: jest.fn(),
}));

import * as db from '../../../utils/dynamodb';
import { handler } from '../listHints';

const INDICES = [
  { id: 'h1', order: 1, text: 'Premier indice, déjà donné.' },
  { id: 'h2', order: 2, text: 'Deuxième indice, jamais donné.' },
  { id: 'h3', order: 3, text: 'Troisième indice, jamais donné.' },
];

/** Demandes de l'équipe t1 sur e1 : une aboutie, une échouée. */
const DEMANDES_T1 = [
  {
    requestId: 'r1',
    teamId: 't1',
    enigmaId: 'e1',
    status: 'done',
    hintId: 'h1',
    hintText: 'Premier indice, déjà donné.',
    requestedAt: '2026-11-01T10:00:00.000Z',
    pointsCharged: 0,
    justification: 'raisonnement interne du modèle',
  },
  {
    requestId: 'r2',
    teamId: 't1',
    enigmaId: 'e1',
    status: 'failed',
    failureReason: 'Indices fermés',
    requestedAt: '2026-11-02T10:00:00.000Z',
  },
];

function evenement(enigmaId = 'e1', userId = 'u1'): APIGatewayProxyEvent {
  return {
    pathParameters: { enigmaId },
    requestContext: { authorizer: { userId } },
  } as unknown as APIGatewayProxyEvent;
}

function enigme(reglage: Record<string, unknown> = {}) {
  return {
    enigmaId: 'e1',
    title: 'Enigme',
    isActive: true,
    hintsEnabled: true,
    points: 20,
    correctPassword: 'MOTDEPASSE-SECRET',
    solution: 'La démarche complète.',
    hints: INDICES,
    ...reglage,
  };
}

function decor(reglage: Record<string, unknown> = {}) {
  (db.getUserById as jest.Mock).mockImplementation(async (id: string) =>
    id === 'u2' ? { userId: 'u2', teamId: 't2' } : { userId: 'u1', teamId: 't1' }
  );
  (db.getTeamById as jest.Mock).mockImplementation(async (id: string) => ({ teamId: id, hasPaid: true }));
  (db.getEnigmaById as jest.Mock).mockResolvedValue(enigme(reglage));
  // La table est interrogée par clé équipe#énigme : chaque équipe n'obtient
  // que ses lignes, ce que le mock reproduit.
  (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockImplementation(
    async (teamId: string, enigmaId: string) =>
      teamId === 't1' && enigmaId === 'e1' ? DEMANDES_T1 : []
  );
}

describe('GET /hints/{enigmaId}', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    decor();
  });

  it('indices ouverts : rend les indices obtenus et hintsAvailable vrai', async () => {
    const reponse = await handler(evenement());
    expect(reponse.statusCode).toBe(200);
    const corps = JSON.parse(reponse.body);
    expect(corps.hintsAvailable).toBe(true);
    expect(corps.hints.map((h: any) => h.id)).toEqual(['h1']);
    expect(corps.remainingHints).toBe(2);
    expect(corps.totalHints).toBe(3);
  });

  it('indices fermés : les indices déjà obtenus restent visibles, hintsAvailable faux', async () => {
    decor({ hintsEnabled: false });
    const reponse = await handler(evenement());
    expect(reponse.statusCode).toBe(200);
    const corps = JSON.parse(reponse.body);
    expect(corps.hintsAvailable).toBe(false);
    expect(corps.hints).toEqual([
      expect.objectContaining({ id: 'h1', text: 'Premier indice, déjà donné.' }),
    ]);
    expect(corps.requests.find((r: any) => r.requestId === 'r1').hint.text).toBe(
      'Premier indice, déjà donné.'
    );
  });

  it('indices ouverts à une date future : hintsAvailable faux, date non divulguée', async () => {
    decor({ hintsEnabled: true, hintsAvailableFrom: '2999-01-01' });
    const corps = JSON.parse((await handler(evenement())).body);
    expect(corps.hintsAvailable).toBe(false);
    expect(JSON.stringify(corps)).not.toContain('2999-01-01');
  });

  it("aucun texte d'indice non donné, ni secret de l'énigme, n'apparaît dans la réponse", async () => {
    for (const reglage of [{}, { hintsEnabled: false }]) {
      decor(reglage);
      const brut = (await handler(evenement())).body;
      expect(brut).not.toContain('jamais donné');
      expect(brut).not.toContain('"h2"');
      expect(brut).not.toContain('"h3"');
      expect(brut).not.toContain('MOTDEPASSE-SECRET');
      expect(brut).not.toContain('La démarche complète.');
      expect(brut).not.toContain('raisonnement interne');
    }
  });

  it('une intrigue non publiée donne 404', async () => {
    decor({ isActive: false });
    const reponse = await handler(evenement());
    expect(reponse.statusCode).toBe(404);
    expect(reponse.body).not.toContain('Premier indice');
    expect(db.getHintRequestsByTeamAndEnigma).not.toHaveBeenCalled();
  });

  it('une intrigue absente donne 404', async () => {
    (db.getEnigmaById as jest.Mock).mockResolvedValue(undefined);
    const reponse = await handler(evenement('inconnue'));
    expect(reponse.statusCode).toBe(404);
  });

  it("l'équipe ne voit que ses propres demandes", async () => {
    const reponse = await handler(evenement('e1', 'u2'));
    expect(reponse.statusCode).toBe(200);
    const corps = JSON.parse(reponse.body);
    expect(db.getHintRequestsByTeamAndEnigma).toHaveBeenCalledWith('t2', 'e1');
    expect(db.getHintRequestsByTeamAndEnigma).not.toHaveBeenCalledWith('t1', expect.anything());
    expect(corps.requests).toEqual([]);
    expect(corps.hints).toEqual([]);
    expect(reponse.body).not.toContain('Premier indice');
  });

  it('refuse un utilisateur sans équipe', async () => {
    (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u3' });
    const reponse = await handler(evenement('e1', 'u3'));
    expect(reponse.statusCode).toBe(403);
  });
});
