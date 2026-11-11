import { APIGatewayProxyEvent } from 'aws-lambda';

// GET /enigmas et GET /enigmas/{id} selon la phase du jeu (utils/gamePhase).
jest.mock('../../../utils/dynamodb', () => ({
  getGameStatus: jest.fn(),
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
  getAllEnigmas: jest.fn(),
  getEnigmaById: jest.fn(),
}));

import * as db from '../../../utils/dynamodb';
import { handler as lister } from '../list';
import { handler as lire } from '../get';

const AVANT = { isStarted: false, launchAt: '2099-01-01T00:00:00.000Z' };
const LANCE = { isStarted: true };

const PRELIM_IMAGE = { enigmaId: 'p1', enigmaNumber: 1, title: 'Affiche', isActive: true, isPreliminary: true, correctPassword: 'THEATRE', hints: [{ id: 'h', order: 1, text: 'x' }] };
const PRELIM_ENIGME = { enigmaId: 'p2', enigmaNumber: 2, title: 'Rébus', isActive: true, isPreliminary: true, correctPassword: 'THEATRE' };
const PRELIM_BROUILLON = { enigmaId: 'p3', enigmaNumber: 3, title: 'Brouillon', isActive: false, isPreliminary: true, correctPassword: 'THEATRE' };
const VRAIE = { enigmaId: 'e1', enigmaNumber: 1, title: 'La Tour', isActive: true, correctPassword: 'EIFFEL', hints: [{ id: 'h', order: 1, text: 'x' }] };

function evenement(enigmaId?: string): APIGatewayProxyEvent {
  return {
    pathParameters: enigmaId ? { enigmaId } : null,
    requestContext: { authorizer: { userId: 'u1' } },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

beforeEach(() => {
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: true });
  // getAllEnigmas ne lit que les publiées : le brouillon n'y est pas.
  (db.getAllEnigmas as jest.Mock).mockResolvedValue([VRAIE, PRELIM_ENIGME, PRELIM_IMAGE]);
});

describe('GET /enigmas', () => {
  test('avant le lancement : les seules préliminaires publiées, sans mot de passe ni indice', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue(AVANT);

    const reponse = corps(await lister(evenement()));

    expect(reponse.phase).toBe('avant-lancement');
    expect(reponse.enigmas.map((e: any) => e.enigmaId)).toEqual(['p1', 'p2']);
    reponse.enigmas.forEach((e: any) => {
      expect(e).not.toHaveProperty('correctPassword');
      expect(e.hintsCount).toBe(0);
    });
  });

  test('après le lancement : les vraies intrigues, plus aucune préliminaire', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue(LANCE);

    const reponse = corps(await lister(evenement()));

    expect(reponse.phase).toBe('lance');
    expect(reponse.enigmas.map((e: any) => e.enigmaId)).toEqual(['e1']);
    expect(reponse.enigmas[0].hintsCount).toBe(1);
  });

  test('équipe bêta avant le lancement : les vraies intrigues', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue(AVANT);
    (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: true, isBetaTeam: true });

    expect(corps(await lister(evenement())).enigmas.map((e: any) => e.enigmaId)).toEqual(['e1']);
  });
});

describe('GET /enigmas/{id}', () => {
  test.each([
    ['préliminaire avant le lancement', AVANT, PRELIM_ENIGME, 200],
    ['préliminaire après le lancement', LANCE, PRELIM_ENIGME, 404],
    ['vraie intrigue avant le lancement', AVANT, VRAIE, 404],
    ['vraie intrigue après le lancement', LANCE, VRAIE, 200],
    ['préliminaire non publiée', AVANT, PRELIM_BROUILLON, 404],
  ])('%s : %s', async (_cas, statut, enigme, attendu) => {
    (db.getGameStatus as jest.Mock).mockResolvedValue(statut);
    (db.getEnigmaById as jest.Mock).mockResolvedValue({ ...enigme });

    const reponse = await lire(evenement(enigme.enigmaId));

    expect(reponse.statusCode).toBe(attendu);
    if (attendu === 200) expect(corps(reponse).enigma).not.toHaveProperty('correctPassword');
  });
});
