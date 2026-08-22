import APIClient from './api-client.js';
import { config, requireCapability, SCOPED, assertScopedResource, currentEnvironment } from '../config/test-config.js';

/**
 * Fabrique de comptes pour les tests.
 *
 * Deux régimes coexistent :
 *  - les comptes stables (`asLeader`, `asMember`) pour les scénarios de lecture,
 *    qui évitent de créer un compte à chaque exécution ;
 *  - les comptes jetables (`createEphemeralUser`) pour tout ce qui crée une
 *    équipe ou modifie une progression, afin que les runs restent indépendants.
 */

let counter = 0;

/**
 * Comptes créés pendant la suite en cours. Les garde-fous purgent ce registre
 * en fin d'exécution : un compte de test créé par n'importe quel chemin est
 * ainsi supprimé, sans que chaque test ait à y penser.
 */
const registre = new Map();

/** Inscrit un compte au nettoyage de fin de suite. */
export function registerForCleanup(email, userId) {
  if (email) registre.set(email, userId);
}

export function pendingCleanup() {
  return [...registre.entries()].map(([email, userId]) => ({ email, userId }));
}

export function clearCleanupRegistry() {
  registre.clear();
}

/**
 * Adresse unique par run. Le préfixe vient de l'environnement : en production,
 * seul `e2e-prod+…` franchit le contrôle de confinement.
 */
export function uniqueEmail() {
  counter += 1;
  const prefix = currentEnvironment().ephemeralEmailPrefix;
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return assertScopedResource(`${prefix}+${stamp}${counter}${rand}@rallyehiver.fr`);
}

/** Crée un compte jetable et renvoie un client déjà authentifié. */
export async function createEphemeralUser({ displayName, label = 'jetable' } = {}) {
  // `scoped` suffit : l'adresse générée est confinée au périmètre de test et le
  // compte est supprimé en fin de scénario.
  requireCapability(SCOPED);

  const email = uniqueEmail();
  const password = config.ephemeralPassword;
  const client = new APIClient({ label });

  const signup = await client.post('/auth/signup', {
    email,
    password,
    displayName: displayName || `Test ${label}`,
  });

  if (!signup.ok) {
    throw new Error(
      `Création du compte ${email} impossible (HTTP ${signup.status}) : ` +
      JSON.stringify(signup.data)
    );
  }

  await client.login(email, password);

  const userId = signup.data.user.userId;
  registerForCleanup(email, userId);

  return { client, email, password, userId };
}

/** Client authentifié sur un compte stable. */
async function asFixture(role) {
  const fixture = config.fixtureUsers[role];

  if (!fixture?.password) {
    throw new Error(
      `Mot de passe absent pour le compte "${role}". ` +
      `Renseigne TEST_${role.toUpperCase()}_PASSWORD dans tests/.env.test.`
    );
  }

  const client = new APIClient({ label: role });
  await client.login(fixture.email, fixture.password);

  return client;
}

export const asLeader = () => asFixture('leader');
export const asMember = () => asFixture('member');
export const asAdmin = () => asFixture('admin');
