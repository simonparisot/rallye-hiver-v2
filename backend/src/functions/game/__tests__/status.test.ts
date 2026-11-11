import { APIGatewayProxyEvent } from 'aws-lambda';

// GET /game/status et les routes d'administration de la phase, sans AWS.
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: () => ({ verify: jest.fn(async () => { throw new Error('jeton invalide'); }) }) },
}));
jest.mock('../../../utils/dynamodb', () => ({
  getGameStatus: jest.fn(),
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
  getUserByCognitoSub: jest.fn(),
  startGame: jest.fn(),
  resetGame: jest.fn(),
}));
jest.mock('../../../utils/adminAuth', () => ({
  requireAdmin: jest.fn(async (userId: string) => {
    if (userId !== 'admin-1') throw new Error('Admin access required');
  }),
}));

import * as db from '../../../utils/dynamodb';
import { handler as statut } from '../status';
import { handler as statutAdmin } from '../../admin/game/status';
import { handler as lancer } from '../../admin/game/start';
import { handler as revenir } from '../../admin/game/reset';

const FUTUR = '2099-01-01T00:00:00.000Z';
const PASSE = '2020-01-01T00:00:00.000Z';

function evenement(userId?: string, corps?: any, headers: Record<string, string> = {}): APIGatewayProxyEvent {
  return {
    headers,
    body: corps === undefined ? null : JSON.stringify(corps),
    requestContext: { authorizer: userId ? { userId } : undefined },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

function equipe(attributs: Record<string, any> = {}) {
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: true, ...attributs });
}

describe('GET /game/status', () => {
  test('visiteur avant le lancement : phase et date, thème neutre', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: FUTUR });

    const reponse = await statut(evenement());

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse)).toEqual({
      isStarted: false,
      startedAt: null,
      phase: 'avant-lancement',
      launchAt: FUTUR,
      themeOfficiel: false,
    });
  });

  test('jeton invalide : répond comme à un visiteur', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: FUTUR });

    const reponse = await statut(evenement(undefined, undefined, { Authorization: 'Bearer faux' }));

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse).themeOfficiel).toBe(false);
  });

  test('visiteur après l\'heure de lancement : thème officiel', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: PASSE });

    expect(corps(await statut(evenement()))).toMatchObject({ phase: 'lance', isStarted: true, themeOfficiel: true });
  });

  test('jeu lancé par l\'orga : thème officiel pour tous, sans lire l\'équipe', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: true, startedAt: '2026-11-11T10:00:00.000Z', launchAt: FUTUR });

    const reponse = corps(await statut(evenement('u1')));

    expect(reponse).toMatchObject({ phase: 'lance', themeOfficiel: true, startedAt: '2026-11-11T10:00:00.000Z' });
    expect(db.getUserById).not.toHaveBeenCalled();
  });

  test('équipe sans préliminaire résolue, avant le lancement : thème neutre', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: FUTUR });
    equipe();

    expect(corps(await statut(evenement('u1')))).toMatchObject({ phase: 'avant-lancement', themeOfficiel: false });
  });

  test('équipe qui a résolu une préliminaire : thème officiel, toujours avant le lancement', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: FUTUR });
    equipe({ themeUnlockedAt: '2026-11-11T10:00:00.000Z' });

    expect(corps(await statut(evenement('u1')))).toMatchObject({ phase: 'avant-lancement', themeOfficiel: true });
  });

  test('équipe non payée qui a résolu une préliminaire : le thème lui reste', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: FUTUR });
    equipe({ hasPaid: false, themeUnlockedAt: '2026-11-11T10:00:00.000Z' });

    expect(corps(await statut(evenement('u1'))).themeOfficiel).toBe(true);
  });

  test('équipe bêta : le jeu lui paraît lancé', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: FUTUR });
    equipe({ isBetaTeam: true });

    expect(corps(await statut(evenement('u1')))).toMatchObject({ phase: 'lance', isStarted: true, themeOfficiel: true });
  });
});

describe('routes d\'administration de la phase', () => {
  test.each([
    ['GET /admin/game/status', () => statutAdmin(evenement('u1'))],
    ['POST /admin/game/start', () => lancer(evenement('u1'))],
    ['POST /admin/game/reset', () => revenir(evenement('u1', {}))],
  ])('%s : 403 pour un joueur', async (_nom, appel) => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: true });

    const reponse = await appel();

    expect(reponse.statusCode).toBe(403);
    expect(db.startGame).not.toHaveBeenCalled();
    expect(db.resetGame).not.toHaveBeenCalled();
  });

  test.each([
    ['GET /admin/game/status', () => statutAdmin(evenement())],
    ['POST /admin/game/start', () => lancer(evenement())],
    ['POST /admin/game/reset', () => revenir(evenement(undefined, {}))],
  ])('%s : 401 sans authentification', async (_nom, appel) => {
    expect((await appel()).statusCode).toBe(401);
  });

  test('GET /admin/game/status : phase réelle, sans passe-droit bêta', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: FUTUR, resetBy: 'admin-1' });

    expect(corps(await statutAdmin(evenement('admin-1')))).toMatchObject({
      phase: 'avant-lancement',
      launchAt: FUTUR,
      launchAtIsDefault: false,
      launchAtPassed: false,
      isStarted: false,
      resetBy: 'admin-1',
    });
  });

  test('POST /admin/game/start lance le jeu', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: FUTUR });
    (db.startGame as jest.Mock).mockResolvedValue({ isStarted: true, launchAt: FUTUR, startedBy: 'admin-1' });

    const reponse = await lancer(evenement('admin-1'));

    expect(reponse.statusCode).toBe(200);
    expect(db.startGame).toHaveBeenCalledWith('admin-1');
    expect(corps(reponse)).toMatchObject({ phase: 'lance', isStarted: true });
  });

  test('POST /admin/game/start : 400 si déjà lancé', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: true });
    expect((await lancer(evenement('admin-1'))).statusCode).toBe(400);
  });

  test('POST /admin/game/reset revient en avant-lancement', async () => {
    (db.resetGame as jest.Mock).mockResolvedValue({ isStarted: false });

    const reponse = await revenir(evenement('admin-1', {}));

    expect(reponse.statusCode).toBe(200);
    expect(db.resetGame).toHaveBeenCalledWith('admin-1', undefined);
    expect(corps(reponse).isStarted).toBe(false);
  });

  test('POST /admin/game/reset accepte une heure de lancement future', async () => {
    (db.resetGame as jest.Mock).mockImplementation(async (_id: string, launchAt: string) => ({ isStarted: false, launchAt }));

    const reponse = await revenir(evenement('admin-1', { launchAt: '2099-01-01T21:50:00+01:00' }));

    expect(reponse.statusCode).toBe(200);
    expect(db.resetGame).toHaveBeenCalledWith('admin-1', '2099-01-01T20:50:00.000Z');
    expect(corps(reponse)).toMatchObject({ phase: 'avant-lancement', launchAt: '2099-01-01T20:50:00.000Z' });
  });

  test.each([
    ['pas une date', 'demain'],
    ['dans le passé', PASSE],
    ['pas une chaîne', 12],
  ])('POST /admin/game/reset refuse une heure %s', async (_cas, launchAt) => {
    const reponse = await revenir(evenement('admin-1', { launchAt }));

    expect(reponse.statusCode).toBe(400);
    expect(db.resetGame).not.toHaveBeenCalled();
  });
});
