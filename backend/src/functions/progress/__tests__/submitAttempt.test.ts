import { APIGatewayProxyEvent } from 'aws-lambda';

// Aucun service n'est appelé : DynamoDB est remplacé, uuid (paquet ESM que jest
// ne charge pas) aussi, et les messages de refus sont figés pour qu'on
// reconnaisse celui qui est tiré au hasard.
jest.mock('../../../utils/dynamodb', () => ({
  // Jeu lancé : la phase (utils/gamePhase) n'est pas le sujet de ces tests.
  getGameStatus: jest.fn(async () => ({ gameId: 'rallye-2025', isStarted: true })),
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
  evaluateParcoursAccess: jest.fn(() => ({ isUnlocked: false, requiredEnigmas: [] })),
}));
jest.mock('../../../utils/wrongPasswordMessages', () => ({
  getWrongPasswordMessages: jest.fn(async () => ['Message au hasard']),
  pickWrongPasswordMessage: jest.fn((messages: string[]) => messages[0]),
}));
jest.mock('uuid', () => ({ v4: () => 'tentative-1' }));

import * as db from '../../../utils/dynamodb';
import { getWrongPasswordMessages } from '../../../utils/wrongPasswordMessages';
import { handler } from '../submitAttempt';

function evenement(password: string): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ enigmaId: 'e1', password }),
    requestContext: { authorizer: { userId: 'u1' }, identity: { sourceIp: '1.2.3.4' } },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

const PRESQUE_BONS = [
  { password: 'Tour Eiffel', message: 'Vous chauffez : quel est son architecte ?' },
  { password: 'Gustave', message: 'Le prénom ne suffit pas.' },
];

function decor(enigme: Record<string, any> = {}) {
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: true, solvedEnigmasCount: 0 });
  (db.getEnigmaById as jest.Mock).mockResolvedValue({
    enigmaId: 'e1',
    isActive: true,
    correctPassword: 'EIFFEL',
    nearMisses: PRESQUE_BONS,
    ...enigme,
  });
  (db.getTeamProgress as jest.Mock).mockResolvedValue(undefined);
  (db.createOrUpdateTeamProgress as jest.Mock).mockResolvedValue({});
  (db.logPasswordAttempt as jest.Mock).mockResolvedValue({});
  (db.updateTeam as jest.Mock).mockResolvedValue({});
  (db.getAllParcours as jest.Mock).mockResolvedValue([]);
}

describe('POST /progress/attempt — presques bons mots de passe', () => {
  beforeEach(() => decor());

  test('saisie exacte d\'un presque bon : message de l\'orga, intrigue non résolue, tentative marquée', async () => {
    const reponse = await handler(evenement('Tour Eiffel'));

    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse)).toEqual({
      success: false,
      message: 'Vous chauffez : quel est son architecte ?',
      nearMiss: true,
    });
    expect(db.logPasswordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'Tour Eiffel', success: false, nearMiss: true })
    );
    expect(db.createOrUpdateTeamProgress).toHaveBeenCalledWith(
      't1',
      'e1',
      expect.objectContaining({ solved: false, attemptCount: 1 })
    );
    expect(db.createOrUpdateTeamProgress).not.toHaveBeenCalledWith(
      't1',
      'e1',
      expect.objectContaining({ solved: true })
    );
    // Le message de l'orga remplace le tirage : la configuration n'est pas lue.
    expect(getWrongPasswordMessages).not.toHaveBeenCalled();
  });

  test('casse, accents, espaces et ponctuation ne comptent pas', async () => {
    const reponse = await handler(evenement('  tour-EÏFFEL ! '));

    expect(corps(reponse)).toEqual({
      success: false,
      message: 'Vous chauffez : quel est son architecte ?',
      nearMiss: true,
    });
  });

  test('chaque presque bon renvoie son propre message', async () => {
    const reponse = await handler(evenement('gustavé'));
    expect(corps(reponse).message).toBe('Le prénom ne suffit pas.');
  });

  test('le vrai mot de passe passe avant un presque bon identique', async () => {
    // Donnée incohérente (la validation admin l'interdit) : le vrai gagne.
    decor({ nearMisses: [{ password: 'eiffel', message: 'Ne devrait jamais sortir' }] });

    const reponse = await handler(evenement('Eiffel'));

    expect(corps(reponse)).toEqual({ success: true, message: 'Bravo ! Énigme résolue !' });
    expect(db.logPasswordAttempt).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(db.logPasswordAttempt).not.toHaveBeenCalledWith(expect.objectContaining({ nearMiss: true }));
  });

  test('mauvaise saisie hors liste : message au hasard, sans marqueur', async () => {
    const reponse = await handler(evenement('Arc de triomphe'));

    expect(corps(reponse)).toEqual({ success: false, message: 'Message au hasard' });
    const journal = (db.logPasswordAttempt as jest.Mock).mock.calls[0][0];
    expect(journal.success).toBe(false);
    expect(journal).not.toHaveProperty('nearMiss');
  });

  test('liste vide : comportement habituel', async () => {
    decor({ nearMisses: [] });
    const reponse = await handler(evenement('Tour Eiffel'));
    expect(corps(reponse)).toEqual({ success: false, message: 'Message au hasard' });
  });

  test('champ absent (intrigue antérieure) : comportement habituel', async () => {
    decor({ nearMisses: undefined });
    const reponse = await handler(evenement('Tour Eiffel'));
    expect(corps(reponse)).toEqual({ success: false, message: 'Message au hasard' });
  });

  test('saisie de pure ponctuation : ne correspond à aucun presque bon', async () => {
    const reponse = await handler(evenement('!!!'));
    expect(corps(reponse)).toEqual({ success: false, message: 'Message au hasard' });
  });
});
