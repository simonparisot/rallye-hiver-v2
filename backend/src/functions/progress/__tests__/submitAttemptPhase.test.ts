import { APIGatewayProxyEvent } from 'aws-lambda';

// POST /progress/attempt selon la phase du jeu et le type d'intrigue
// (utils/gamePhase), et le non-comptage des préliminaires.
jest.mock('../../../utils/dynamodb', () => ({
  getGameStatus: jest.fn(),
  getEnigmaById: jest.fn(),
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
  getTeamProgress: jest.fn(),
  createOrUpdateTeamProgress: jest.fn(),
  logPasswordAttempt: jest.fn(),
  updateTeam: jest.fn(),
  getAllParcours: jest.fn(),
  grantParcoursAccess: jest.fn(),
  getTeamParcoursAccess: jest.fn(),
}));
jest.mock('../../../utils/parcoursAccess', () => ({
  loadAccessContext: jest.fn(),
  evaluateParcoursAccess: jest.fn(() => ({ isUnlocked: true, requiredEnigmas: [] })),
}));
jest.mock('../../../utils/wrongPasswordMessages', () => ({
  getWrongPasswordMessages: jest.fn(async () => ['Raté']),
  pickWrongPasswordMessage: jest.fn((messages: string[]) => messages[0]),
}));
jest.mock('uuid', () => ({ v4: () => 'tentative-1' }));

import * as db from '../../../utils/dynamodb';
import { handler } from '../submitAttempt';

const AVANT = { isStarted: false, launchAt: '2099-01-01T00:00:00.000Z' };
const LANCE = { isStarted: true };

const PRELIM = { enigmaId: 'p1', isActive: true, isPreliminary: true, correctPassword: 'THEATRE' };
const VRAIE = { enigmaId: 'e1', isActive: true, correctPassword: 'EIFFEL' };

function evenement(enigmaId: string, password: string): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ enigmaId, password }),
    requestContext: { authorizer: { userId: 'u1' }, identity: { sourceIp: '1.2.3.4' } },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

function decor(statut: any, enigme: any, equipe: Record<string, any> = {}) {
  (db.getGameStatus as jest.Mock).mockResolvedValue(statut);
  (db.getEnigmaById as jest.Mock).mockResolvedValue({ ...enigme });
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: true, solvedEnigmasCount: 3, ...equipe });
  (db.getTeamProgress as jest.Mock).mockResolvedValue(undefined);
  (db.createOrUpdateTeamProgress as jest.Mock).mockResolvedValue({});
  (db.logPasswordAttempt as jest.Mock).mockResolvedValue({});
  (db.updateTeam as jest.Mock).mockResolvedValue({});
  (db.getAllParcours as jest.Mock).mockResolvedValue([{ parcoursId: 'tournee-libre', requiredEnigmaIds: [] }]);
  (db.getTeamParcoursAccess as jest.Mock).mockResolvedValue(undefined);
}

describe('POST /progress/attempt — phase du jeu', () => {
  test('vraie intrigue avant le lancement : 403 clair, rien n\'est journalisé', async () => {
    decor(AVANT, VRAIE);

    const reponse = await handler(evenement('e1', 'EIFFEL'));

    expect(reponse.statusCode).toBe(403);
    expect(corps(reponse).error).toMatch(/lancement/);
    expect(db.logPasswordAttempt).not.toHaveBeenCalled();
    expect(db.createOrUpdateTeamProgress).not.toHaveBeenCalled();
  });

  test('préliminaire après le lancement : 403 clair', async () => {
    decor(LANCE, PRELIM);

    const reponse = await handler(evenement('p1', 'THEATRE'));

    expect(reponse.statusCode).toBe(403);
    expect(corps(reponse).error).toMatch(/préliminaires sont closes/);
    expect(db.logPasswordAttempt).not.toHaveBeenCalled();
  });

  test('équipe bêta : la vraie intrigue se joue avant le lancement', async () => {
    decor(AVANT, VRAIE, { isBetaTeam: true });

    const reponse = await handler(evenement('e1', 'EIFFEL'));

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse).success).toBe(true);
  });

  test('vraie intrigue après le lancement : comptée comme avant', async () => {
    decor(LANCE, VRAIE);

    const reponse = await handler(evenement('e1', 'Eiffel'));

    expect(corps(reponse)).toEqual({ success: true, message: 'Bravo ! Énigme résolue !' });
    expect(db.updateTeam).toHaveBeenCalledWith('t1', { solvedEnigmasCount: 4 });
    expect(db.updateTeam).toHaveBeenCalledWith('t1', expect.objectContaining({ lastActivityAt: expect.any(String) }));
    expect(corps(reponse)).not.toHaveProperty('themeOfficiel');
  });
});

describe('POST /progress/attempt — préliminaire avant le lancement', () => {
  test('bonne réponse : résolue, journalisée, thème débloqué, mais pas comptée', async () => {
    decor(AVANT, PRELIM);

    const reponse = await handler(evenement('p1', 'théâtre'));

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse)).toEqual({ success: true, message: 'Bravo ! Énigme résolue !', themeOfficiel: true });
    // Journalisée et marquée résolue, pour l'affichage.
    expect(db.logPasswordAttempt).toHaveBeenCalledWith(expect.objectContaining({ enigmaId: 'p1', success: true }));
    expect(db.createOrUpdateTeamProgress).toHaveBeenCalledWith('t1', 'p1', expect.objectContaining({ solved: true }));
    // Le thème est débloqué pour l'équipe…
    expect(db.updateTeam).toHaveBeenCalledWith('t1', { themeUnlockedAt: expect.any(String) });
    // … mais rien ne compte : ni le compteur, ni l'activité, ni les tournées.
    expect(db.updateTeam).not.toHaveBeenCalledWith('t1', expect.objectContaining({ solvedEnigmasCount: expect.anything() }));
    expect(db.updateTeam).not.toHaveBeenCalledWith('t1', expect.objectContaining({ lastActivityAt: expect.anything() }));
    expect(db.getAllParcours).not.toHaveBeenCalled();
    expect(db.grantParcoursAccess).not.toHaveBeenCalled();
  });

  test('thème déjà débloqué : la date n\'est pas réécrite', async () => {
    decor(AVANT, PRELIM, { themeUnlockedAt: '2026-11-10T10:00:00.000Z' });
    (db.getTeamProgress as jest.Mock).mockResolvedValue({ solved: true, attemptCount: 1 });

    const reponse = await handler(evenement('p1', 'THEATRE'));

    expect(corps(reponse).themeOfficiel).toBe(true);
    expect(corps(reponse).message).toMatch(/déjà résolue/);
    expect(db.updateTeam).not.toHaveBeenCalled();
  });

  test('mauvaise réponse : journalisée, pas de thème', async () => {
    decor(AVANT, PRELIM);

    const reponse = await handler(evenement('p1', 'OPERA'));

    expect(corps(reponse)).toEqual({ success: false, message: 'Raté' });
    expect(db.logPasswordAttempt).toHaveBeenCalledWith(expect.objectContaining({ enigmaId: 'p1', success: false }));
    expect(db.updateTeam).not.toHaveBeenCalled();
  });

  test('équipe non payée : refusée comme pour toute intrigue', async () => {
    decor(AVANT, PRELIM, { hasPaid: false });

    expect((await handler(evenement('p1', 'THEATRE'))).statusCode).toBe(403);
    expect(db.logPasswordAttempt).not.toHaveBeenCalled();
  });
});
