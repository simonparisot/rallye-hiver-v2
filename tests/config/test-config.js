import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  currentEnvironment,
  requireCapability,
  requireWritable,
  assertScopedResource,
  READ,
  SCOPED,
  FULL,
} from './environments.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Charge .env.test s'il existe. Les valeurs déjà présentes dans l'environnement gagnent. */
function loadEnv() {
  try {
    const envContent = readFileSync(join(__dirname, '../.env.test'), 'utf-8');

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();

      if (key && value && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Absence de .env.test : les valeurs par défaut de l'environnement suffisent.
  }
}

loadEnv();

const env = currentEnvironment();

export const config = {
  env,
  // L'URL vient de la définition d'environnement, jamais d'une valeur écrite en dur
  // dans .env.test — c'est ce qui empêche un fichier local de rediriger vers la prod.
  apiUrl: env.apiUrl,
  siteUrl: env.siteUrl,

  /**
   * Comptes stables du décor.
   *
   * Les adresses par défaut suivent le préfixe de l'environnement : en
   * production, seules celles en `e2e-prod+…` franchissent le contrôle de
   * confinement, si bien qu'un compte du décor ne peut jamais être confondu
   * avec celui d'un participant.
   */
  fixtureUsers: {
    leader: {
      email: env.name === 'prod' ? 'e2e-prod@rallyehiver.fr' : 'e2e-leader@rallyehiver.fr',
      // Mot de passe distinct par environnement : celui de production ne doit
      // pas se retrouver dans un fichier partagé avec l'environnement de test.
      password: env.name === 'prod'
        ? process.env.TEST_PROD_PASSWORD
        : process.env.TEST_LEADER_PASSWORD,
      displayName: 'E2E Pilote',
    },
    member: {
      email: env.name === 'prod' ? 'e2e-prod+member@rallyehiver.fr' : 'e2e-member@rallyehiver.fr',
      password: env.name === 'prod'
        ? process.env.TEST_PROD_PASSWORD
        : process.env.TEST_MEMBER_PASSWORD,
      displayName: 'E2E Second',
    },
    admin: {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    },
    /** Compte dédié aux tests exécutés sur la production. */
    prod: {
      email: process.env.TEST_PROD_EMAIL || 'e2e-prod@rallyehiver.fr',
      password: process.env.TEST_PROD_PASSWORD,
      displayName: 'E2E Prod Monitor',
    },
  },

  /**
   * Équipe de test permanente, cible des scénarios authentifiés et seule équipe
   * que le nettoyage est autorisé à toucher. Un identifiant par environnement :
   * confondre les deux ferait viser une équipe réelle en production.
   */
  teamId: env.name === 'prod'
    ? process.env.TEST_PROD_TEAM_ID
    : process.env.TEST_TEAM_ID,

  /** Mot de passe des comptes jetables créés pendant un run. */
  ephemeralPassword: process.env.TEST_EPHEMERAL_PASSWORD || 'E2eRallye!2027',
};

export {
  currentEnvironment,
  requireCapability,
  requireWritable,
  assertScopedResource,
  READ,
  SCOPED,
  FULL,
};
