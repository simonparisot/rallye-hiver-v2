/**
 * Provisionne le décor permanent des tests fonctionnels :
 *   - un compte « pilote », membre stable de l'équipe de test ;
 *   - une équipe de test, marquée payée, conservée d'un run à l'autre ;
 *   - un second compte, membre de cette équipe.
 *
 * Idempotent : relancer le script ne recrée rien de ce qui existe déjà.
 *
 *   TEST_ENV=test node scripts/provision.js
 *   TEST_ENV=prod ALLOW_PROD_WRITES=1 node scripts/provision.js
 *
 * La création d'équipe est un acte de provisionnement, pas un test : elle a lieu
 * une fois, puis l'équipe est conservée. Les tests, eux, ne créent jamais d'équipe.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import APIClient from '../helpers/api-client.js';
import { dynamo, table, TABLES } from '../helpers/aws.js';
import { config, currentEnvironment, requireCapability, SCOPED, assertScopedResource } from '../config/test-config.js';

const TEAM_NAME = 'ZZZ Equipe de test E2E (ne pas supprimer)';

async function ensureAccount({ email, password, displayName }) {
  assertScopedResource(email);

  const client = new APIClient({ label: email });
  const signup = await client.post('/auth/signup', { email, password, displayName });

  if (signup.status === 201) {
    console.log(`  compte créé      : ${email}`);
  } else {
    console.log(`  compte existant  : ${email}`);
  }

  await client.login(email, password);
  return client;
}

async function ensureTeam(leader) {
  const me = await leader.get('/auth/me');

  if (me.data.teamId) {
    console.log(`  équipe existante : ${me.data.teamId} (rôle ${me.data.role})`);
    return me.data.teamId;
  }

  const created = await leader.post('/teams', { teamName: TEAM_NAME });

  if (!created.ok) {
    throw new Error(`Création de l'équipe impossible : ${JSON.stringify(created.data)}`);
  }

  const teamId = created.data.teamId || created.data.team?.teamId;
  console.log(`  équipe créée     : ${teamId}`);
  return teamId;
}

async function ensurePaid(teamId) {
  const current = await dynamo().send(new GetCommand({
    TableName: table(TABLES.teams),
    Key: { teamId },
  }));

  if (current.Item?.hasPaid) {
    console.log('  paiement         : déjà marqué');
    return;
  }

  await dynamo().send(new UpdateCommand({
    TableName: table(TABLES.teams),
    Key: { teamId },
    UpdateExpression: 'SET hasPaid = :true, updatedAt = :now',
    ExpressionAttributeValues: { ':true': true, ':now': new Date().toISOString() },
  }));

  console.log('  paiement         : marqué (le flux Stripe est hors périmètre)');
}

async function ensureMember(member, teamId, leader) {
  const me = await member.get('/auth/me');

  if (me.data.teamId === teamId) {
    console.log('  second membre    : déjà dans l\'équipe');
    return;
  }

  const join = await member.post(`/teams/${teamId}/join`, {});

  if (!join.ok && !/pending/i.test(JSON.stringify(join.data))) {
    throw new Error(`Demande d'adhésion impossible : ${JSON.stringify(join.data)}`);
  }

  const memberId = me.data.userId;
  const approve = await leader.post(`/teams/${teamId}/approve/${memberId}`, {});

  if (!approve.ok) {
    throw new Error(`Approbation impossible : ${JSON.stringify(approve.data)}`);
  }

  console.log('  second membre    : ajouté à l\'équipe');
}

async function main() {
  const env = currentEnvironment();
  requireCapability(SCOPED);

  console.log(`Provisionnement sur « ${env.name} » (${env.apiUrl})`);

  const leader = await ensureAccount({
    email: config.fixtureUsers.leader.email,
    password: config.fixtureUsers.leader.password,
    displayName: 'E2E Pilote',
  });

  const teamId = await ensureTeam(leader);
  await ensurePaid(teamId);

  const member = await ensureAccount({
    email: config.fixtureUsers.member.email,
    password: config.fixtureUsers.member.password,
    displayName: 'E2E Second',
  });

  await ensureMember(member, teamId, leader);

  console.log(`\nTEST_TEAM_ID=${teamId}`);
  console.log('À reporter dans tests/.env.test.');
}

main().catch((err) => {
  console.error('Échec du provisionnement :', err.message);
  process.exit(1);
});
