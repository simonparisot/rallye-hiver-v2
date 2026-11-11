// La couche DynamoDB est remplacée : on vérifie seulement les commandes
// envoyées et la manière dont le module interprète les réponses.
jest.mock('../dynamodb', () => ({
  dynamoDb: { send: jest.fn() },
  GAME_STATUS_TABLE: 'rallye-test-game-status',
}));

import { dynamoDb } from '../dynamodb';
import {
  DEFAULT_WRONG_PASSWORD_MESSAGES,
  WRONG_PASSWORD_MESSAGES_KEY,
  WrongPasswordMessagesValidationError,
  getWrongPasswordMessages,
  getStoredWrongPasswordMessages,
  normalizeWrongPasswordMessages,
  pickWrongPasswordMessage,
  resetWrongPasswordMessages,
  setWrongPasswordMessages,
} from '../wrongPasswordMessages';

const send = dynamoDb.send as jest.Mock;

describe('DEFAULT_WRONG_PASSWORD_MESSAGES', () => {
  it('reprend les 20 messages historiques', () => {
    expect(DEFAULT_WRONG_PASSWORD_MESSAGES).toHaveLength(20);
    expect(DEFAULT_WRONG_PASSWORD_MESSAGES[0]).toBe("Oups ! Ce n'est pas le bon code. Essayez encore !");
  });
});

describe('getWrongPasswordMessages', () => {
  it("lit l'item de configuration par sa clé dans la table game-status", async () => {
    send.mockResolvedValue({ Item: { gameId: WRONG_PASSWORD_MESSAGES_KEY, messages: ['A', 'B'] } });
    await expect(getWrongPasswordMessages()).resolves.toEqual(['A', 'B']);
    const command = send.mock.calls[0][0];
    expect(command.input).toEqual({
      TableName: 'rallye-test-game-status',
      Key: { gameId: 'settings#wrong-password-messages' },
    });
  });

  it("retombe sur la liste par défaut quand l'item est absent", async () => {
    send.mockResolvedValue({});
    await expect(getWrongPasswordMessages()).resolves.toEqual([...DEFAULT_WRONG_PASSWORD_MESSAGES]);
  });

  it('retombe sur la liste par défaut quand la liste est vide', async () => {
    send.mockResolvedValue({ Item: { gameId: WRONG_PASSWORD_MESSAGES_KEY, messages: [] } });
    await expect(getWrongPasswordMessages()).resolves.toEqual([...DEFAULT_WRONG_PASSWORD_MESSAGES]);
  });

  it('ignore les entrées vides ou non textuelles', async () => {
    send.mockResolvedValue({ Item: { messages: ['  ', 3, 'Raté'] } });
    await expect(getWrongPasswordMessages()).resolves.toEqual(['Raté']);
  });

  it('retombe sur la liste par défaut si DynamoDB échoue', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockRejectedValue(new Error('boom'));
    await expect(getWrongPasswordMessages()).resolves.toEqual([...DEFAULT_WRONG_PASSWORD_MESSAGES]);
  });

  it('signale si la liste en vigueur est celle par défaut', async () => {
    send.mockResolvedValueOnce({});
    expect((await getStoredWrongPasswordMessages()).isDefault).toBe(true);
    send.mockResolvedValueOnce({ Item: { messages: ['A'], updatedAt: 't' } });
    expect(await getStoredWrongPasswordMessages()).toMatchObject({ messages: ['A'], isDefault: false, updatedAt: 't' });
  });
});

describe('pickWrongPasswordMessage', () => {
  const messages = ['un', 'deux', 'trois'];

  it('tire selon le générateur fourni', () => {
    expect(pickWrongPasswordMessage(messages, () => 0)).toBe('un');
    expect(pickWrongPasswordMessage(messages, () => 0.5)).toBe('deux');
    expect(pickWrongPasswordMessage(messages, () => 0.9999)).toBe('trois');
  });

  it('reste dans les bornes même si le générateur renvoie 1', () => {
    expect(pickWrongPasswordMessage(messages, () => 1)).toBe('trois');
  });

  it('utilise la liste par défaut si la liste est vide', () => {
    expect(pickWrongPasswordMessage([], () => 0)).toBe(DEFAULT_WRONG_PASSWORD_MESSAGES[0]);
  });

  it('renvoie toujours un message de la liste avec Math.random', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(messages).toContain(pickWrongPasswordMessage(messages));
    }
  });
});

describe('normalizeWrongPasswordMessages', () => {
  it('trime et supprime les doublons en gardant l’ordre', () => {
    expect(normalizeWrongPasswordMessages([' B ', 'A', 'B', 'A '])).toEqual(['B', 'A']);
  });

  it.each([
    ['pas un tableau', 'abc'],
    ['tableau vide', []],
    ['message vide', ['ok', '   ']],
    ['message non textuel', ['ok', 42]],
    ['message trop long', ['x'.repeat(301)]],
    ['trop de messages', Array.from({ length: 101 }, (_, i) => `m${i}`)],
  ])('refuse : %s', (_label, input) => {
    expect(() => normalizeWrongPasswordMessages(input)).toThrow(WrongPasswordMessagesValidationError);
  });

  it('accepte 100 messages de 300 caractères', () => {
    const input = Array.from({ length: 100 }, (_, i) => `${i}`.padEnd(300, 'x'));
    expect(normalizeWrongPasswordMessages(input)).toHaveLength(100);
  });

  it('compte les messages après dédoublonnage', () => {
    const input = [...Array.from({ length: 100 }, (_, i) => `m${i}`), 'm0'];
    expect(normalizeWrongPasswordMessages(input)).toHaveLength(100);
  });
});

describe('setWrongPasswordMessages / resetWrongPasswordMessages', () => {
  it('enregistre la liste normalisée sous la clé de configuration', async () => {
    send.mockResolvedValue({});
    const saved = await setWrongPasswordMessages([' A ', 'A', 'B'], 'admin-1');
    expect(saved).toMatchObject({ messages: ['A', 'B'], isDefault: false, updatedBy: 'admin-1' });
    const item = send.mock.calls[0][0].input.Item;
    expect(item).toMatchObject({ gameId: WRONG_PASSWORD_MESSAGES_KEY, messages: ['A', 'B'], updatedBy: 'admin-1' });
  });

  it("n'écrit rien si la liste est invalide", async () => {
    await expect(setWrongPasswordMessages([])).rejects.toThrow(WrongPasswordMessagesValidationError);
    expect(send).not.toHaveBeenCalled();
  });

  it("supprime l'item pour revenir aux messages par défaut", async () => {
    send.mockResolvedValue({});
    const reset = await resetWrongPasswordMessages();
    expect(reset).toEqual({ messages: [...DEFAULT_WRONG_PASSWORD_MESSAGES], isDefault: true });
    expect(send.mock.calls[0][0].input).toEqual({
      TableName: 'rallye-test-game-status',
      Key: { gameId: WRONG_PASSWORD_MESSAGES_KEY },
    });
  });
});
