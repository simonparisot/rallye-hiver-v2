import { QueryCommand, ScanCommand, DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { AdminDeleteUserCommand, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { dynamo, cognito, table, TABLES } from './aws.js';
import { currentEnvironment, assertScopedResource } from '../config/environments.js';
import { config } from '../config/test-config.js';

/**
 * Effacement des traces laissées par un run.
 *
 * Ce module supprime des données, y compris en production : chaque opération est
 * donc bornée par une vérification explicite. Un identifiant d'équipe qui n'est
 * pas celui de l'équipe de test, ou une adresse hors du motif réservé,
 * interrompt le nettoyage plutôt que de risquer d'effacer les données d'un
 * participant réel.
 */

/**
 * Parcourt un Scan ou un Query jusqu'au bout.
 *
 * DynamoDB borne chaque réponse à 1 Mo : sur une table volumineuse, se
 * contenter de la première page laisse des éléments derrière soi. C'est ce qui
 * est arrivé en production, où la table des tentatives dépasse 6 Mo — le
 * nettoyage n'en voyait qu'une fraction alors qu'il paraissait complet sur
 * l'environnement de test.
 */
async function parcourirTout(construireCommande) {
  const items = [];
  let clefDepart;

  do {
    const reponse = await dynamo().send(construireCommande(clefDepart));
    items.push(...(reponse.Items ?? []));
    clefDepart = reponse.LastEvaluatedKey;
  } while (clefDepart);

  return items;
}

/** Interdit toute opération sur une autre équipe que l'équipe de test. */
function assertTestTeam(teamId) {
  if (!config.teamId) {
    throw new Error('TEST_TEAM_ID absent : impossible de délimiter le nettoyage.');
  }

  if (teamId !== config.teamId) {
    throw new Error(
      `Refus de nettoyer l'équipe "${teamId}" : seule l'équipe de test ` +
      `"${config.teamId}" est concernée.`
    );
  }

  return teamId;
}

/** Supprime un compte de test : Cognito, table users, appartenance à l'équipe. */
export async function deleteParticipant({ email, userId }) {
  assertScopedResource(email);

  const env = currentEnvironment();

  // 1. Cognito — le compte est identifié par son adresse.
  try {
    const found = await cognito().send(new ListUsersCommand({
      UserPoolId: env.cognitoUserPoolId,
      Filter: `email = "${email}"`,
      Limit: 2,
    }));

    for (const user of found.Users ?? []) {
      await cognito().send(new AdminDeleteUserCommand({
        UserPoolId: env.cognitoUserPoolId,
        Username: user.Username,
      }));
    }
  } catch (err) {
    console.warn(`  nettoyage Cognito de ${email} : ${err.message}`);
  }

  // 2. Table users — retrouvée par balayage, l'index est sur cognitoSub.
  const users = await parcourirTout((clefDepart) => new ScanCommand({
    TableName: table(TABLES.users),
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email },
    ExclusiveStartKey: clefDepart,
  }));

  for (const user of users) {
    assertScopedResource(user.email);
    await dynamo().send(new DeleteCommand({
      TableName: table(TABLES.users),
      Key: { userId: user.userId },
    }));
  }

  // 3. Appartenance résiduelle à l'équipe de test.
  if (userId && config.teamId) {
    await removeFromTestTeam(userId);
  }
}

/** Retire un identifiant des membres et des demandes de l'équipe de test. */
export async function removeFromTestTeam(userId) {
  const teamId = assertTestTeam(config.teamId);

  const current = await dynamo().send(new GetCommand({
    TableName: table(TABLES.teams),
    Key: { teamId },
  }));

  if (!current.Item) return;

  const members = (current.Item.members ?? []).filter((m) =>
    (typeof m === 'string' ? m : m.userId) !== userId
  );
  const pending = (current.Item.pendingRequests ?? []).filter((p) =>
    (typeof p === 'string' ? p : p.userId) !== userId
  );

  await dynamo().send(new UpdateCommand({
    TableName: table(TABLES.teams),
    Key: { teamId },
    UpdateExpression: 'SET members = :m, pendingRequests = :p, updatedAt = :now',
    ExpressionAttributeValues: {
      ':m': members,
      ':p': pending,
      ':now': new Date().toISOString(),
    },
  }));
}

/**
 * Remet l'équipe de test dans son état de départ : aucune énigme résolue,
 * aucune tentative enregistrée, aucun parcours débloqué ni complété.
 *
 * Sans cela, un test qui résout une énigme la trouverait déjà résolue au run
 * suivant — et les tentatives fausseraient le calcul de difficulté en production.
 */
export async function resetTestTeamProgress() {
  const teamId = assertTestTeam(config.teamId);
  const supprimes = { progress: 0, attempts: 0, parcoursAccess: 0 };

  // Progression par énigme
  const progress = await parcourirTout((clefDepart) => new QueryCommand({
    TableName: table(TABLES.progress),
    KeyConditionExpression: 'teamId = :t',
    ExpressionAttributeValues: { ':t': teamId },
    ExclusiveStartKey: clefDepart,
  }));

  for (const item of progress) {
    await dynamo().send(new DeleteCommand({
      TableName: table(TABLES.progress),
      Key: { teamId: item.teamId, enigmaId: item.enigmaId },
    }));
    supprimes.progress += 1;
  }

  // Tentatives de mot de passe — balayage filtré sur l'équipe de test.
  const attempts = await parcourirTout((clefDepart) => new ScanCommand({
    TableName: table(TABLES.attempts),
    FilterExpression: 'teamId = :t',
    ExpressionAttributeValues: { ':t': teamId },
    ExclusiveStartKey: clefDepart,
  }));

  for (const item of attempts) {
    assertTestTeam(item.teamId);
    await dynamo().send(new DeleteCommand({
      TableName: table(TABLES.attempts),
      Key: { attemptId: item.attemptId },
    }));
    supprimes.attempts += 1;
  }

  // Accès aux parcours
  const access = await parcourirTout((clefDepart) => new QueryCommand({
    TableName: table(TABLES.parcoursAccess),
    KeyConditionExpression: 'teamId = :t',
    ExpressionAttributeValues: { ':t': teamId },
    ExclusiveStartKey: clefDepart,
  }));

  for (const item of access) {
    await dynamo().send(new DeleteCommand({
      TableName: table(TABLES.parcoursAccess),
      Key: { teamId: item.teamId, parcoursId: item.parcoursId },
    }));
    supprimes.parcoursAccess += 1;
  }

  // Compteurs portés par l'équipe elle-même
  await dynamo().send(new UpdateCommand({
    TableName: table(TABLES.teams),
    Key: { teamId },
    UpdateExpression: 'SET solvedEnigmasCount = :zero, updatedAt = :now',
    ExpressionAttributeValues: { ':zero': 0, ':now': new Date().toISOString() },
  }));

  return supprimes;
}

/**
 * Rattrapage : supprime les comptes de test orphelins d'un run interrompu.
 * Sans filet de ce genre, un échec en cours de route laisse des comptes derrière lui.
 */
export async function sweepOrphanedParticipants({ olderThanMinutes = 60 } = {}) {
  const env = currentEnvironment();
  const limite = Date.now() - olderThanMinutes * 60 * 1000;
  const supprimes = [];

  const users = await parcourirTout((clefDepart) => new ScanCommand({
    TableName: table(TABLES.users),
    ExclusiveStartKey: clefDepart,
  }));

  // Un compte jetable porte toujours un « + » après le préfixe de l'environnement.
  // Restreindre le balayage à ce motif évite qu'un compte nominatif du domaine
  // rallyehiver.fr soit emporté par erreur.
  const motifJetable = new RegExp(`^${env.ephemeralEmailPrefix}\\+`);

  for (const user of users) {
    if (!user.email) continue;
    if (!env.scopedEmailPattern.test(user.email)) continue;
    if (!motifJetable.test(user.email)) continue;

    // Les comptes permanents du décor ne sont jamais balayés.
    const permanents = [
      config.fixtureUsers.leader.email,
      config.fixtureUsers.member.email,
      config.fixtureUsers.prod.email,
    ];
    if (permanents.includes(user.email)) continue;

    if (new Date(user.createdAt).getTime() > limite) continue;

    await deleteParticipant({ email: user.email, userId: user.userId });
    supprimes.push(user.email);
  }

  return supprimes;
}
