/**
 * Donne les droits d'administration à un compte, sur un environnement jetable.
 *
 *   TEST_ENV=indices node scripts/make-admin.js e2e-admin@rallyehiver.fr 'MotDePasse!2027'
 *
 * Le back-office ne s'appuie ni sur un groupe Cognito ni sur un attribut du
 * pool : `requireAdmin()` (backend/src/utils/adminAuth.ts) lit l'attribut
 * `isAdmin` de l'enregistrement DynamoDB du compte, et `/admin/auth/login` fait
 * la même vérification après l'authentification Cognito. Promouvoir quelqu'un
 * revient donc à poser `isAdmin: true` dans la table users, ce qu'aucun
 * endpoint n'expose, d'où ce script.
 *
 * Le compte est créé au passage s'il n'existe pas et qu'un mot de passe est
 * fourni : sur un bac à sable, le pool Cognito est vide au départ.
 *
 * Réservé aux environnements de capacité `full` : la production plafonne à
 * `scoped`, le script s'y interrompt avant le premier appel.
 */
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import APIClient from '../helpers/api-client.js';
import { dynamo, table, TABLES } from '../helpers/aws.js';
import {
  config,
  currentEnvironment,
  requireCapability,
  FULL,
  assertScopedResource,
} from '../config/test-config.js';

async function trouverParEmail(email) {
  // Balayage plutôt que requête : l'index de la table users porte sur
  // cognitoSub, pas sur l'adresse. La table d'un bac à sable tient en une page.
  const reponse = await dynamo().send(new ScanCommand({
    TableName: table(TABLES.users),
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email },
  }));

  return reponse.Items?.[0] ?? null;
}

async function main() {
  const [email, motDePasse] = process.argv.slice(2);

  if (!email) {
    console.error('Usage : TEST_ENV=<bac-à-sable> node scripts/make-admin.js <email> [mot-de-passe]');
    process.exit(1);
  }

  const env = currentEnvironment();

  // `full` : créer un compte et le promouvoir n'est réversible que sur un
  // environnement jetable.
  requireCapability(FULL);
  assertScopedResource(email);

  console.log(`Promotion sur « ${env.name} » (${env.apiUrl})`);

  let utilisateur = await trouverParEmail(email);

  if (!utilisateur) {
    if (!motDePasse) {
      throw new Error(
        `Compte ${email} inexistant. Fournis un mot de passe en second argument ` +
        `pour le créer au passage.`
      );
    }

    const client = new APIClient({ label: email });
    const inscription = await client.post('/auth/signup', {
      email,
      password: motDePasse,
      displayName: 'Administration',
    });

    if (!inscription.ok) {
      throw new Error(
        `Création du compte impossible (HTTP ${inscription.status}) : ` +
        JSON.stringify(inscription.data)
      );
    }

    console.log(`  compte créé      : ${email}`);
    utilisateur = await trouverParEmail(email);
  } else {
    console.log(`  compte existant  : ${email}`);
  }

  if (!utilisateur) {
    throw new Error(`Compte ${email} introuvable dans ${table(TABLES.users)}.`);
  }

  if (utilisateur.isAdmin === true) {
    console.log('  droits           : déjà administrateur');
  } else {
    await dynamo().send(new UpdateCommand({
      TableName: table(TABLES.users),
      Key: { userId: utilisateur.userId },
      UpdateExpression: 'SET isAdmin = :vrai, updatedAt = :maintenant',
      ExpressionAttributeValues: { ':vrai': true, ':maintenant': new Date().toISOString() },
    }));

    console.log('  droits           : isAdmin posé');
  }

  console.log(`\nTEST_ADMIN_EMAIL=${email}`);
  if (motDePasse) console.log(`TEST_ADMIN_PASSWORD=${motDePasse}`);
  console.log('À reporter dans tests/.env.test pour les tests du back-office.');
  console.log(`Vérification : POST ${config.apiUrl}/admin/auth/login`);
}

main().catch((err) => {
  console.error('Échec de la promotion :', err.message);
  process.exit(1);
});
