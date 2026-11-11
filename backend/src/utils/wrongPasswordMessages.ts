import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb, GAME_STATUS_TABLE } from './dynamodb';

/**
 * Messages servis au hasard quand une équipe donne un mauvais mot de passe.
 *
 * Le module ne sait rien de ce qui est vérifié (intrigue, tournée…) : tout
 * handler qui refuse un mot de passe peut appeler
 * `pickWrongPasswordMessage(await getWrongPasswordMessages())`.
 *
 * Stockage : un item de configuration dans la table game-status, à côté de
 * l'item du statut du jeu (`gameId = 'rallye-2025'`). La table n'a qu'une clé
 * de partition `gameId` et n'est lue que par GetItem sur la clé du jeu : l'item
 * `settings#wrong-password-messages` ne peut pas être confondu avec le statut.
 */

export const DEFAULT_WRONG_PASSWORD_MESSAGES: readonly string[] = Object.freeze([
  "Oups ! Ce n'est pas le bon code. Essayez encore !",
  "Presque ! Enfin... non, pas du tout en fait.",
  "Raté ! Mais ne vous découragez pas !",
  "Hmm... Non. Retournez voir l'énigme !",
  "Ce code ne correspond à rien... pour l'instant !",
  "Essayez encore ! Vous êtes sur la bonne voie... peut-être.",
  "Pas encore ! Mais chaque tentative vous rapproche du but.",
  "Non, non, non ! Mais l'échec est le début du succès !",
  "Raté ! La réponse est ailleurs, cherchez encore.",
  "Ce n'est pas ça ! Mais bravo d'avoir essayé.",
  "Incorrect ! Peut-être qu'une petite pause café vous aidera ?",
  "Perdu ! Mais Rome ne s'est pas faite en un jour.",
  "Nope ! Retour à l'énigme, détective !",
  "Faux ! Mais vous chauffez... ou pas.",
  "Non ! Allez, courage, vous allez y arriver !",
  "Raté ! Einstein aussi s'est trompé parfois.",
  "Ce n'est pas la bonne réponse... Réessayez !",
  "Incorrect ! Les grands esprits se trompent aussi.",
  "Oups ! Pas tout à fait. Nouvelle tentative ?",
  "Non ! Mais l'erreur est humaine... et instructive !",
]);

/** Clé (`gameId`) de l'item de configuration dans la table game-status. */
export const WRONG_PASSWORD_MESSAGES_KEY = 'settings#wrong-password-messages';

export const MAX_WRONG_PASSWORD_MESSAGES = 100;
export const MAX_WRONG_PASSWORD_MESSAGE_LENGTH = 300;

export interface StoredWrongPasswordMessages {
  messages: string[];
  /** true quand aucune liste exploitable n'est enregistrée (absente ou vide). */
  isDefault: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

/** Lit l'item de configuration ; retombe sur la liste par défaut s'il est absent ou vide. */
export async function getStoredWrongPasswordMessages(): Promise<StoredWrongPasswordMessages> {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: GAME_STATUS_TABLE,
      Key: { gameId: WRONG_PASSWORD_MESSAGES_KEY },
    })
  );
  const item = result.Item;
  const messages: string[] = Array.isArray(item?.messages)
    ? item!.messages.filter((m: unknown): m is string => typeof m === 'string' && m.trim() !== '')
    : [];
  if (messages.length === 0) {
    return { messages: [...DEFAULT_WRONG_PASSWORD_MESSAGES], isDefault: true };
  }
  return { messages, isDefault: false, updatedAt: item?.updatedAt, updatedBy: item?.updatedBy };
}

/**
 * La liste à servir aux équipes. Pas de cache : une lecture DynamoDB (GetItem
 * à lecture cohérente à terme, 0,5 RCU) par mot de passe faux, pour qu'un
 * changement de l'orga s'applique tout de suite. Si la lecture échoue, on
 * retombe sur la liste par défaut plutôt que de faire échouer la tentative.
 */
export async function getWrongPasswordMessages(): Promise<string[]> {
  try {
    return (await getStoredWrongPasswordMessages()).messages;
  } catch (err) {
    console.error('Lecture des messages de mauvais mot de passe impossible, liste par défaut :', err);
    return [...DEFAULT_WRONG_PASSWORD_MESSAGES];
  }
}

/** Tire un message au hasard. Pur : `random` est injectable pour les tests. */
export function pickWrongPasswordMessage(
  messages: readonly string[],
  random: () => number = Math.random
): string {
  const pool = messages.length > 0 ? messages : DEFAULT_WRONG_PASSWORD_MESSAGES;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index];
}

export class WrongPasswordMessagesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WrongPasswordMessagesValidationError';
  }
}

/**
 * Valide et normalise une liste envoyée par l'admin : textes trimés, non
 * vides, au plus 300 caractères, doublons supprimés (ordre conservé), entre 1
 * et 100 messages. Lève une `WrongPasswordMessagesValidationError` sinon.
 */
export function normalizeWrongPasswordMessages(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw new WrongPasswordMessagesValidationError(
      'Le champ messages est obligatoire et doit être un tableau de textes'
    );
  }
  const seen = new Set<string>();
  const messages: string[] = [];
  input.forEach((raw, i) => {
    if (typeof raw !== 'string') {
      throw new WrongPasswordMessagesValidationError(`Le message n°${i + 1} doit être un texte`);
    }
    const message = raw.trim();
    if (!message) {
      throw new WrongPasswordMessagesValidationError(`Le message n°${i + 1} est vide`);
    }
    if (message.length > MAX_WRONG_PASSWORD_MESSAGE_LENGTH) {
      throw new WrongPasswordMessagesValidationError(
        `Le message n°${i + 1} dépasse ${MAX_WRONG_PASSWORD_MESSAGE_LENGTH} caractères`
      );
    }
    if (!seen.has(message)) {
      seen.add(message);
      messages.push(message);
    }
  });
  if (messages.length === 0) {
    throw new WrongPasswordMessagesValidationError('Il faut au moins un message');
  }
  if (messages.length > MAX_WRONG_PASSWORD_MESSAGES) {
    throw new WrongPasswordMessagesValidationError(
      `Au plus ${MAX_WRONG_PASSWORD_MESSAGES} messages (${messages.length} reçus)`
    );
  }
  return messages;
}

/** Valide, enregistre et renvoie la liste. */
export async function setWrongPasswordMessages(
  input: unknown,
  updatedBy?: string
): Promise<StoredWrongPasswordMessages> {
  const messages = normalizeWrongPasswordMessages(input);
  const updatedAt = new Date().toISOString();
  await dynamoDb.send(
    new PutCommand({
      TableName: GAME_STATUS_TABLE,
      Item: {
        gameId: WRONG_PASSWORD_MESSAGES_KEY,
        messages,
        updatedAt,
        ...(updatedBy ? { updatedBy } : {}),
      },
    })
  );
  return { messages, isDefault: false, updatedAt, updatedBy };
}

/** Supprime la configuration : les messages par défaut reprennent la main. */
export async function resetWrongPasswordMessages(): Promise<StoredWrongPasswordMessages> {
  await dynamoDb.send(
    new DeleteCommand({
      TableName: GAME_STATUS_TABLE,
      Key: { gameId: WRONG_PASSWORD_MESSAGES_KEY },
    })
  );
  return { messages: [...DEFAULT_WRONG_PASSWORD_MESSAGES], isDefault: true };
}
