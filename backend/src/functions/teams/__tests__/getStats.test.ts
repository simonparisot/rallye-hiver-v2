import { APIGatewayProxyEvent } from 'aws-lambda';

// GET /teams/stats : les préliminaires ne comptent pas (utils/gamePhase).
jest.mock('../../../utils/dynamodb', () => ({
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
  getAllTeamProgress: jest.fn(),
  getAllTeamParcoursAccess: jest.fn(),
  getAllEnigmasForAdmin: jest.fn(),
  getAllParcours: jest.fn(),
  getPasswordAttemptsByTeam: jest.fn(),
  dynamoDb: { send: jest.fn() },
  PASSWORD_ATTEMPTS_TABLE: 'tentatives',
}));
jest.mock('../../../utils/testTeams', () => ({
  getTestTeamIds: jest.fn(async () => new Set()),
  excludeTestTeamRows: (rows: any[]) => rows,
}));

import * as db from '../../../utils/dynamodb';
import { handler } from '../getStats';

const evenement = { requestContext: { authorizer: { userId: 'u1' } } } as unknown as APIGatewayProxyEvent;

test('ni le total, ni les résolues, ni les tentatives ne comptent les préliminaires', async () => {
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', teamName: 'Les Orcades', members: ['u1'] });
  (db.getAllEnigmasForAdmin as jest.Mock).mockResolvedValue([
    { enigmaId: 'e1', isActive: true, points: 10 },
    { enigmaId: 'e2', isActive: true, points: 10 },
    { enigmaId: 'e3', isActive: false, points: 10 },
    { enigmaId: 'p1', isActive: true, isPreliminary: true, points: 10 },
    { enigmaId: 'p2', isActive: true, isPreliminary: true, points: 10 },
  ]);
  (db.getAllParcours as jest.Mock).mockResolvedValue([]);
  (db.getAllTeamParcoursAccess as jest.Mock).mockResolvedValue([]);
  (db.getAllTeamProgress as jest.Mock).mockResolvedValue([
    { enigmaId: 'e1', solved: true },
    { enigmaId: 'p1', solved: true },
    { enigmaId: 'p2', solved: true },
  ]);
  (db.getPasswordAttemptsByTeam as jest.Mock).mockResolvedValue([
    { teamId: 't1', enigmaId: 'e1' },
    { teamId: 't1', enigmaId: 'p1' },
    { teamId: 't1', enigmaId: 'p1' },
  ]);
  (db.dynamoDb.send as jest.Mock).mockResolvedValue({
    Items: [
      { teamId: 't1', enigmaId: 'e1' },
      { teamId: 't1', enigmaId: 'p1' },
      { teamId: 't2', enigmaId: 'p2' },
    ],
  });

  const reponse = JSON.parse((await handler(evenement)).body);

  expect(reponse).toMatchObject({
    enigmasSolved: 1,
    totalEnigmas: 2,
    totalPoints: 10,
    passwordAttemptsCount: 1,
  });
});
