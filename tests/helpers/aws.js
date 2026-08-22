import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { fromIni } from '@aws-sdk/credential-providers';
import { currentEnvironment } from '../config/environments.js';

/**
 * Accès AWS pour le provisionnement et le nettoyage.
 *
 * Les tests fonctionnels passent par l'API ; ces clients servent uniquement à
 * préparer un état de départ connu et à effacer les traces d'un run — deux
 * opérations qu'aucun endpoint public n'expose.
 */

const clients = new Map();

function credentialsFor(env) {
  if (!env.awsProfile) return undefined;
  return fromIni({ profile: env.awsProfile });
}

export function dynamo() {
  const env = currentEnvironment();
  const key = `ddb:${env.name}`;

  if (!clients.has(key)) {
    clients.set(key, DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: 'eu-west-1', credentials: credentialsFor(env) }),
      { marshallOptions: { removeUndefinedValues: true } }
    ));
  }

  return clients.get(key);
}

export function cognito() {
  const env = currentEnvironment();
  const key = `cognito:${env.name}`;

  if (!clients.has(key)) {
    clients.set(key, new CognitoIdentityProviderClient({
      region: 'eu-west-1',
      credentials: credentialsFor(env),
    }));
  }

  return clients.get(key);
}

/** Nom complet d'une table pour l'environnement courant. */
export function table(suffix) {
  const env = currentEnvironment();

  if (!env.tablePrefix) {
    throw new Error(`L'environnement "${env.name}" n'expose pas de tables DynamoDB.`);
  }

  return `${env.tablePrefix}${suffix}`;
}

export const TABLES = {
  users: 'users',
  teams: 'teams',
  enigmas: 'enigmas',
  parcours: 'parcours',
  progress: 'team-enigma-progress',
  attempts: 'password-attempts',
  parcoursAccess: 'team-parcours-access',
  gameStatus: 'game-status',
};
