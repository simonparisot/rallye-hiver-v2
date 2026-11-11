import { APIGatewayProxyEvent } from 'aws-lambda';

// Indices et phase du jeu (utils/gamePhase) : une préliminaire n'a jamais
// d'indice ; une vraie intrigue n'en a qu'une fois le jeu lancé.
jest.mock('../../../utils/dynamodb', () => ({
  getGameStatus: jest.fn(),
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
  getEnigmaById: jest.fn(),
  getTeamProgress: jest.fn(),
  createOrUpdateTeamProgress: jest.fn(),
  createHintRequest: jest.fn(),
  getHintRequestsByTeamAndEnigma: jest.fn(),
}));

import * as db from '../../../utils/dynamodb';
import { handler as demander } from '../requestHint';
import { handler as lister } from '../listHints';

const AVANT = { isStarted: false, launchAt: '2099-01-01T00:00:00.000Z' };
const LANCE = { isStarted: true };
const INDICES = [{ id: 'h1', order: 1, text: 'Regardez l\'affiche.' }];
const PRELIM = { enigmaId: 'p1', isActive: true, isPreliminary: true, hintsEnabled: true, hints: INDICES };
const VRAIE = { enigmaId: 'e1', isActive: true, hintsEnabled: true, hints: INDICES };

function evenement(enigmaId: string): APIGatewayProxyEvent {
  return {
    pathParameters: { enigmaId },
    body: JSON.stringify({ progress: 'Nous avons tout essayé sans trouver la moindre piste valable.' }),
    requestContext: { authorizer: { userId: 'u1' } },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

function decor(statut: any, enigme: any) {
  (db.getGameStatus as jest.Mock).mockResolvedValue(statut);
  (db.getEnigmaById as jest.Mock).mockResolvedValue({ ...enigme });
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: true });
  (db.getTeamProgress as jest.Mock).mockResolvedValue(undefined);
  (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([]);
}

describe('POST /hints/{enigmaId}/request', () => {
  test('préliminaire : 403, même avec des indices rédigés et ouverts', async () => {
    decor(AVANT, PRELIM);

    const reponse = await demander(evenement('p1'));

    expect(reponse.statusCode).toBe(403);
    expect(corps(reponse).error).toMatch(/préliminaires n'ont pas d'indice/);
    expect(db.createHintRequest).not.toHaveBeenCalled();
  });

  test('vraie intrigue avant le lancement : 403', async () => {
    decor(AVANT, VRAIE);

    const reponse = await demander(evenement('e1'));

    expect(reponse.statusCode).toBe(403);
    expect(corps(reponse).error).toMatch(/lancement/);
  });
});

describe('GET /hints/{enigmaId}', () => {
  test('préliminaire avant le lancement : aucun indice proposé', async () => {
    decor(AVANT, PRELIM);

    const reponse = corps(await lister(evenement('p1')));

    expect(reponse).toMatchObject({ totalHints: 0, remainingHints: 0, hintsAvailable: false });
  });

  test('préliminaire après le lancement, vraie intrigue avant : 404', async () => {
    decor(LANCE, PRELIM);
    expect((await lister(evenement('p1'))).statusCode).toBe(404);

    decor(AVANT, VRAIE);
    expect((await lister(evenement('e1'))).statusCode).toBe(404);
  });
});
