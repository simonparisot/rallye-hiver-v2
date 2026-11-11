import { APIGatewayProxyEvent } from 'aws-lambda';

// Rien ne sort du processus : DynamoDB, le contrôle admin et uuid sont des faux.
jest.mock('../../../../utils/dynamodb', () => ({
  dynamoDb: { send: jest.fn() },
  GAME_STATUS_TABLE: 'rallye-test-game-status',
}));
jest.mock('../../../../utils/adminAuth', () => ({
  requireAdmin: jest.fn(),
}));
jest.mock('uuid', () => ({ v4: () => 'uuid-test' }));

import { dynamoDb } from '../../../../utils/dynamodb';
import { requireAdmin } from '../../../../utils/adminAuth';
import { DEFAULT_WRONG_PASSWORD_MESSAGES } from '../../../../utils/wrongPasswordMessages';
import { getHandler, putHandler, deleteHandler } from '../wrongPasswordMessages';

const send = dynamoDb.send as jest.Mock;
const admin = requireAdmin as jest.Mock;

function evenement(corps?: unknown, userId: string | null = 'admin-1'): APIGatewayProxyEvent {
  return {
    body: corps === undefined ? null : typeof corps === 'string' ? corps : JSON.stringify(corps),
    requestContext: { authorizer: userId ? { userId } : undefined },
  } as unknown as APIGatewayProxyEvent;
}

const lire = (res: { body: string }) => JSON.parse(res.body);

beforeEach(() => {
  admin.mockResolvedValue(undefined);
  send.mockResolvedValue({});
});

describe('contrôle d’accès', () => {
  it.each([
    ['GET', getHandler],
    ['PUT', putHandler],
    ['DELETE', deleteHandler],
  ])('%s renvoie 401 sans utilisateur', async (_m, handler) => {
    const res = await handler(evenement({ messages: ['A'] }, null));
    expect(res.statusCode).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', getHandler],
    ['PUT', putHandler],
    ['DELETE', deleteHandler],
  ])('%s renvoie 403 si non admin, sans toucher la base', async (_m, handler) => {
    admin.mockRejectedValue(new Error('Admin access required'));
    const res = await handler(evenement({ messages: ['A'] }));
    expect(res.statusCode).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('GET /admin/settings/wrong-password-messages', () => {
  it('expose la liste par défaut quand rien n’est configuré', async () => {
    const res = await getHandler(evenement());
    expect(res.statusCode).toBe(200);
    const body = lire(res);
    expect(body.isDefault).toBe(true);
    expect(body.messages).toEqual([...DEFAULT_WRONG_PASSWORD_MESSAGES]);
    expect(body.defaults).toEqual([...DEFAULT_WRONG_PASSWORD_MESSAGES]);
    expect(body.limits).toEqual({ maxMessages: 100, maxLength: 300 });
  });

  it('renvoie la liste configurée', async () => {
    send.mockResolvedValue({ Item: { messages: ['A'], updatedAt: '2026-11-11T10:00:00.000Z', updatedBy: 'u' } });
    const body = lire(await getHandler(evenement()));
    expect(body).toMatchObject({ messages: ['A'], isDefault: false, updatedAt: '2026-11-11T10:00:00.000Z' });
  });
});

describe('PUT /admin/settings/wrong-password-messages', () => {
  it('enregistre et renvoie la liste nettoyée', async () => {
    const res = await putHandler(evenement({ messages: [' Raté ! ', 'Raté !', 'Perdu'] }));
    expect(res.statusCode).toBe(200);
    expect(lire(res)).toMatchObject({ messages: ['Raté !', 'Perdu'], isDefault: false, updatedBy: 'admin-1' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sans champ messages', {}],
    ['liste vide', { messages: [] }],
    ['message vide', { messages: ['A', ' '] }],
    ['message trop long', { messages: ['x'.repeat(301)] }],
    ['trop de messages', { messages: Array.from({ length: 101 }, (_, i) => `m${i}`) }],
    ['message non textuel', { messages: [{ texte: 'A' }] }],
    ['JSON invalide', '{pas du json'],
  ])('400 : %s', async (_label, corps) => {
    const res = await putHandler(evenement(corps));
    expect(res.statusCode).toBe(400);
    expect(lire(res).error).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it('500 si DynamoDB échoue', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockRejectedValue(new Error('boom'));
    const res = await putHandler(evenement({ messages: ['A'] }));
    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE /admin/settings/wrong-password-messages', () => {
  it('supprime la configuration et renvoie la liste par défaut', async () => {
    const res = await deleteHandler(evenement());
    expect(res.statusCode).toBe(200);
    expect(lire(res)).toMatchObject({ isDefault: true, messages: [...DEFAULT_WRONG_PASSWORD_MESSAGES] });
    expect(send.mock.calls[0][0].constructor.name).toBe('DeleteCommand');
  });
});
