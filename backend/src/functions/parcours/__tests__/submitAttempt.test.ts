import { APIGatewayProxyEvent } from 'aws-lambda';

// Aucun service n'est appelé : DynamoDB est remplacé, et uuid (paquet ESM que
// jest ne charge pas) aussi. Le calcul d'accès est le vrai.
jest.mock('../../../utils/dynamodb', () => ({
  // Jeu lancé : la phase (utils/gamePhase) n'est pas le sujet de ces tests.
  getGameStatus: jest.fn(async () => ({ gameId: 'rallye-2025', isStarted: true })),
  getUserById: jest.fn(),
  getParcoursById: jest.fn(),
  getTeamParcoursAccess: jest.fn(),
  markTeamParcoursCompleted: jest.fn(),
  logParcoursAttempt: jest.fn(),
  updateTeam: jest.fn(),
  getAllEnigmasForAdmin: jest.fn(),
  getAllTeamProgress: jest.fn(),
}));
jest.mock('../../../utils/adminAuth', () => ({ requireAdmin: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'tentative-1' }));
// Les messages de mauvais mot de passe sont ceux des intrigues, modifiables
// par l'organisation et lus en base : le module est remplacé.
jest.mock('../../../utils/wrongPasswordMessages', () => ({
  getWrongPasswordMessages: jest.fn(async () => ['Message choisi par l\'orga.']),
  pickWrongPasswordMessage: jest.fn((messages: string[]) => messages[0]),
}));

import * as db from '../../../utils/dynamodb';
import { handler } from '../submitAttempt';
import { getWrongPasswordMessages, pickWrongPasswordMessage } from '../../../utils/wrongPasswordMessages';

function evenement(corps: any, parcoursId = 'p1'): APIGatewayProxyEvent {
  return {
    pathParameters: { parcoursId },
    body: JSON.stringify(corps),
    requestContext: { authorizer: { userId: 'u1' }, identity: { sourceIp: '1.2.3.4' } },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

function decorNominal() {
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getParcoursById as jest.Mock).mockResolvedValue({
    parcoursId: 'p1',
    title: 'Tournée des Halles',
    isActive: true,
    requiredEnigmaIds: ['e1'],
    correctPassword: 'Le Malade imaginaire',
  });
  (db.getAllEnigmasForAdmin as jest.Mock).mockResolvedValue([
    { enigmaId: 'e1', enigmaNumber: 1, title: 'Une', isActive: true },
  ]);
  (db.getAllTeamProgress as jest.Mock).mockResolvedValue([{ enigmaId: 'e1', solved: true }]);
  (db.getTeamParcoursAccess as jest.Mock).mockResolvedValue(undefined);
  (db.markTeamParcoursCompleted as jest.Mock).mockResolvedValue({});
  (db.logParcoursAttempt as jest.Mock).mockResolvedValue({});
  (db.updateTeam as jest.Mock).mockResolvedValue({});
}

describe('POST /parcours/{parcoursId}/attempt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    decorNominal();
  });

  test('mot de passe juste : la tournée est validée pour l\'équipe', async () => {
    const reponse = await handler(evenement({ password: '  le malade-IMAGINAIRE ! ' }));

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse)).toEqual({
      success: true,
      message: expect.any(String),
      alreadyCompleted: false,
    });
    expect(db.markTeamParcoursCompleted).toHaveBeenCalledWith('t1', 'p1', expect.any(String));
    expect(db.updateTeam).toHaveBeenCalledWith('t1', { lastActivityAt: expect.any(String) });
    expect(db.logParcoursAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: 'tentative-1',
        teamId: 't1',
        parcoursId: 'p1',
        password: '  le malade-IMAGINAIRE ! ',
        success: true,
        attemptedBy: 'u1',
        ipAddress: '1.2.3.4',
      })
    );
  });

  test('mot de passe faux : 200, succès faux, rien n\'est validé, la tentative est notée', async () => {
    const reponse = await handler(evenement({ password: 'Tartuffe' }));

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse)).toEqual({ success: false, message: 'Message choisi par l\'orga.' });
    expect(getWrongPasswordMessages).toHaveBeenCalled();
    expect(pickWrongPasswordMessage).toHaveBeenCalledWith(['Message choisi par l\'orga.']);
    expect(db.markTeamParcoursCompleted).not.toHaveBeenCalled();
    expect(db.logParcoursAttempt).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(db.updateTeam).toHaveBeenCalled();
  });

  test('tournée verrouillée : 403, sans journaliser', async () => {
    (db.getAllTeamProgress as jest.Mock).mockResolvedValue([]);

    const reponse = await handler(evenement({ password: 'Le Malade imaginaire' }));

    expect(reponse.statusCode).toBe(403);
    expect(corps(reponse).error).toBe('Parcours locked');
    expect(db.logParcoursAttempt).not.toHaveBeenCalled();
    expect(db.markTeamParcoursCompleted).not.toHaveBeenCalled();
  });

  test('une intrigue résolue sur deux suffit : la tournée est ouverte et se valide', async () => {
    (db.getParcoursById as jest.Mock).mockResolvedValue({
      parcoursId: 'p1',
      isActive: true,
      requiredEnigmaIds: ['e1', 'e2'],
      correctPassword: 'Le Malade imaginaire',
    });
    (db.getAllEnigmasForAdmin as jest.Mock).mockResolvedValue([
      { enigmaId: 'e1', enigmaNumber: 1, title: 'Une', isActive: true },
      { enigmaId: 'e2', enigmaNumber: 2, title: 'Deux', isActive: true },
    ]);
    (db.getAllTeamProgress as jest.Mock).mockResolvedValue([
      { enigmaId: 'e1', solved: false },
      { enigmaId: 'e2', solved: true },
    ]);

    const reponse = await handler(evenement({ password: 'le malade imaginaire' }));

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse).success).toBe(true);
    expect(db.markTeamParcoursCompleted).toHaveBeenCalledWith('t1', 'p1', expect.any(String));
  });

  test('tournée non publiée : 403 aussi', async () => {
    (db.getParcoursById as jest.Mock).mockResolvedValue({
      parcoursId: 'p1',
      isActive: false,
      requiredEnigmaIds: [],
      correctPassword: 'X',
    });

    const reponse = await handler(evenement({ password: 'X' }));

    expect(reponse.statusCode).toBe(403);
    expect(corps(reponse).error).toBe('Parcours locked');
  });

  test('tournée sans mot de passe : 409 avec un message clair', async () => {
    (db.getParcoursById as jest.Mock).mockResolvedValue({
      parcoursId: 'p1',
      isActive: true,
      requiredEnigmaIds: [],
      correctPassword: '',
    });

    const reponse = await handler(evenement({ password: 'peu importe' }));

    expect(reponse.statusCode).toBe(409);
    expect(corps(reponse).error).toMatch(/pas encore disponible/);
    expect(db.logParcoursAttempt).not.toHaveBeenCalled();
  });

  test('tournée déjà réalisée : bon mot de passe accepté, sans revalider', async () => {
    (db.getTeamParcoursAccess as jest.Mock).mockResolvedValue({
      teamId: 't1',
      parcoursId: 'p1',
      completed: true,
      completedAt: '2026-11-01T10:00:00.000Z',
    });

    const reponse = await handler(evenement({ password: 'le malade imaginaire' }));

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse)).toEqual({ success: true, message: expect.any(String), alreadyCompleted: true });
    expect(db.markTeamParcoursCompleted).not.toHaveBeenCalled();
  });

  test('joueur hors équipe : 403', async () => {
    (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1' });

    const reponse = await handler(evenement({ password: 'X' }));

    expect(reponse.statusCode).toBe(403);
    expect(db.getParcoursById).not.toHaveBeenCalled();
    expect(db.logParcoursAttempt).not.toHaveBeenCalled();
  });

  test('tournée inconnue : 404', async () => {
    (db.getParcoursById as jest.Mock).mockResolvedValue(undefined);

    const reponse = await handler(evenement({ password: 'X' }, 'inconnue'));

    expect(reponse.statusCode).toBe(404);
  });

  test('mot de passe absent ou vide : 400', async () => {
    expect((await handler(evenement({}))).statusCode).toBe(400);
    expect((await handler(evenement({ password: '   ' }))).statusCode).toBe(400);
    expect((await handler(evenement({ password: 12 }))).statusCode).toBe(400);
  });

  test('corps null, mal formé ou qui n\'est pas un objet : 400 « Corps invalide »', async () => {
    for (const brut of ['null', '{pas du json', '"texte"', '42', '[]']) {
      const reponse = await handler({
        pathParameters: { parcoursId: 'p1' },
        body: brut,
        requestContext: { authorizer: { userId: 'u1' } },
      } as unknown as APIGatewayProxyEvent);

      expect(reponse.statusCode).toBe(400);
      expect(corps(reponse)).toEqual({ error: 'Corps invalide' });
    }
    expect(db.getUserById).not.toHaveBeenCalled();
  });

  // Le mauvais mot de passe vient du module partagé (mocké ici) : ses messages
  // par défaut parlent d'« énigme », ce qui est neutre. Les messages propres à
  // cette route, eux, ne doivent pas employer le vocabulaire du théâtre.
  test('les messages ne parlent pas de « tournée » : ils valent pour tous les thèmes', async () => {
    const messages = [
      corps(await handler(evenement({ password: 'Tartuffe' }))).message,
      corps(await handler(evenement({ password: 'le malade imaginaire' }))).message,
    ];
    (db.getTeamParcoursAccess as jest.Mock).mockResolvedValue({ completed: true });
    messages.push(corps(await handler(evenement({ password: 'le malade imaginaire' }))).message);
    (db.getParcoursById as jest.Mock).mockResolvedValue({ parcoursId: 'p1', isActive: true, requiredEnigmaIds: [] });
    messages.push(corps(await handler(evenement({ password: 'x' }))).error);

    messages.forEach((m) => expect(m).not.toMatch(/tourn|parcours|intrigue|troupe/i));
  });

  test('sans utilisateur authentifié : 401', async () => {
    const reponse = await handler({
      pathParameters: { parcoursId: 'p1' },
      body: JSON.stringify({ password: 'X' }),
      requestContext: {},
    } as unknown as APIGatewayProxyEvent);

    expect(reponse.statusCode).toBe(401);
  });
});
