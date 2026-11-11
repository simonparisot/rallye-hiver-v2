import { APIGatewayProxyEvent } from 'aws-lambda';

// Les tournées n'existent pas avant le lancement (utils/gamePhase) : ni dans
// les listes, ni à la lecture, ni à la validation.
jest.mock('../../../utils/dynamodb', () => ({
  getGameStatus: jest.fn(),
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
  getAllParcours: jest.fn(),
  getParcoursById: jest.fn(),
  getAllTeamParcoursAccess: jest.fn(),
  getTeamParcoursAccess: jest.fn(),
  getAllEnigmasForAdmin: jest.fn(),
  getAllTeamProgress: jest.fn(),
  markTeamParcoursCompleted: jest.fn(),
  logParcoursAttempt: jest.fn(),
  updateTeam: jest.fn(),
}));
jest.mock('uuid', () => ({ v4: () => 'tentative-1' }));

import * as db from '../../../utils/dynamodb';
import { handler as listerJoueur } from '../../progress/getAccessibleParcours';
import { handler as lister } from '../list';
import { handler as lire } from '../get';
import { handler as verifier } from '../checkAccess';
import { handler as valider } from '../submitAttempt';

const AVANT = { isStarted: false, launchAt: '2099-01-01T00:00:00.000Z' };
const TOURNEE = {
  parcoursId: 'p1',
  parcoursNumber: 1,
  title: 'Les quais',
  pdfUrl: 'https://x/quais.pdf',
  requiredEnigmaIds: [],
  correctPassword: 'MOLIERE',
  isActive: true,
};

function evenement(corps?: any): APIGatewayProxyEvent {
  return {
    pathParameters: { parcoursId: 'p1' },
    body: corps === undefined ? null : JSON.stringify(corps),
    requestContext: { authorizer: { userId: 'u1' }, identity: { sourceIp: '1.2.3.4' } },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

beforeEach(() => {
  (db.getGameStatus as jest.Mock).mockResolvedValue(AVANT);
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: true });
  (db.getAllParcours as jest.Mock).mockResolvedValue([TOURNEE]);
  (db.getParcoursById as jest.Mock).mockResolvedValue(TOURNEE);
  (db.getAllTeamParcoursAccess as jest.Mock).mockResolvedValue([]);
  (db.getAllEnigmasForAdmin as jest.Mock).mockResolvedValue([]);
  (db.getAllTeamProgress as jest.Mock).mockResolvedValue([]);
});

describe('avant le lancement', () => {
  test('GET /progress/parcours : aucune tournée, aucun PDF', async () => {
    const reponse = corps(await listerJoueur(evenement()));

    expect(reponse).toEqual({ teamId: 't1', parcours: [], accessibleParcours: [], count: 0, phase: 'avant-lancement' });
    expect(JSON.stringify(reponse)).not.toContain('quais');
  });

  test('GET /parcours : liste vide', async () => {
    expect(corps(await lister(evenement()))).toEqual({ parcours: [], count: 0, phase: 'avant-lancement' });
  });

  test('GET /parcours/{id} et /access : 404', async () => {
    expect((await lire(evenement())).statusCode).toBe(404);
    expect((await verifier(evenement())).statusCode).toBe(404);
  });

  test('POST /parcours/{id}/attempt : 403, rien n\'est journalisé', async () => {
    const reponse = await valider(evenement({ password: 'MOLIERE' }));

    expect(reponse.statusCode).toBe(403);
    expect(db.logParcoursAttempt).not.toHaveBeenCalled();
  });
});

describe('après le lancement', () => {
  beforeEach(() => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: true });
  });

  test('GET /progress/parcours : la tournée libre, avec son PDF', async () => {
    const reponse = corps(await listerJoueur(evenement()));

    expect(reponse.phase).toBe('lance');
    expect(reponse.parcours).toHaveLength(1);
    expect(reponse.parcours[0]).toMatchObject({ parcoursId: 'p1', isUnlocked: true, pdfUrl: 'https://x/quais.pdf' });
  });

  test('GET /parcours : la liste, sans PDF', async () => {
    const reponse = corps(await lister(evenement()));

    expect(reponse.parcours).toEqual([expect.objectContaining({ parcoursId: 'p1' })]);
    expect(reponse.parcours[0]).not.toHaveProperty('pdfUrl');
  });
});
