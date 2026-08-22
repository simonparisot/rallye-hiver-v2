/**
 * Environnements cibles et niveaux d'écriture autorisés.
 *
 * Trois capacités, du plus restrictif au plus permissif :
 *
 *   read   — consultation seule. Aucun appel ne laisse de trace : santé du site,
 *            disponibilité des endpoints, respect du contrat d'API, latence.
 *
 *   scoped — écriture autorisée, mais confinée aux ressources de test déclarées
 *            (comptes dont l'adresse correspond à `scopedEmailPattern`) et
 *            réversible : l'état final doit être identique à l'état initial.
 *
 *   full   — écriture libre, y compris création de comptes jetables en série.
 *
 * La production accepte `read` et `scoped`, jamais `full`. En outre, toute
 * écriture en production exige l'opt-in explicite ALLOW_PROD_WRITES=1, pour
 * qu'un run lancé par distraction ne puisse pas y toucher.
 */

export const READ = 'read';
export const SCOPED = 'scoped';
export const FULL = 'full';

const RANK = { [READ]: 0, [SCOPED]: 1, [FULL]: 2 };

export const ENVIRONMENTS = {
  test: {
    name: 'test',
    apiUrl: 'https://010h0tev7c.execute-api.eu-west-1.amazonaws.com/test',
    siteUrl: 'https://test.rallyehiver.fr',
    awsProfile: 'rallye-test',
    awsAccount: '516341735006',
    cognitoUserPoolId: 'eu-west-1_Sxj76KSAf',
    tablePrefix: 'rallye-hiver-backend-test-',
    enigmasBucket: 'rallyehiver-enigmas-test',
    capability: FULL,
    requiresOptIn: false,
    scopedEmailPattern: /@rallyehiver\.fr$/,
    ephemeralEmailPrefix: 'e2e',
  },

  prod: {
    name: 'prod',
    apiUrl: 'https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod',
    // L'application de jeu vit désormais sur le sous-domaine de son édition ;
    // rallyehiver.fr sert le site vitrine, qui n'appelle aucune API.
    siteUrl: 'https://2026.rallyehiver.fr',
    awsProfile: 'rallye',
    awsAccount: '388660028527',
    cognitoUserPoolId: 'eu-west-1_cRMw8lhM3',
    tablePrefix: 'rallye-hiver-backend-',
    enigmasBucket: 'rallyehiver-enigmas',
    capability: SCOPED,
    requiresOptIn: true,
    // Seules ces adresses peuvent être touchées par un test en production.
    // Un participant réel ne peut pas correspondre à ce motif.
    scopedEmailPattern: /^e2e-prod(\+[^@]*)?@rallyehiver\.fr$/,
    // Les comptes jetables créés en production portent ce préfixe, seul motif
    // que `scopedEmailPattern` accepte : un compte de test ne peut pas être
    // confondu avec celui d'un participant.
    ephemeralEmailPrefix: 'e2e-prod',
  },

  local: {
    name: 'local',
    apiUrl: 'http://localhost:3001',
    siteUrl: 'http://localhost:3000',
    awsProfile: null,
    awsAccount: null,
    cognitoUserPoolId: null,
    tablePrefix: null,
    enigmasBucket: null,
    capability: FULL,
    requiresOptIn: false,
    scopedEmailPattern: /.*/,
    ephemeralEmailPrefix: 'e2e',
  },
};

/** Environnement actif, piloté par TEST_ENV (test par défaut). */
export function currentEnvironment() {
  const name = process.env.TEST_ENV || 'test';
  const env = ENVIRONMENTS[name];

  if (!env) {
    throw new Error(
      `Environnement inconnu : "${name}". Valeurs possibles : ${Object.keys(ENVIRONMENTS).join(', ')}`
    );
  }

  return env;
}

/**
 * Vérifie que l'environnement courant autorise le niveau demandé.
 * Interrompt le run sinon, plutôt que de laisser un test écrire où il ne doit pas.
 */
export function requireCapability(needed) {
  const env = currentEnvironment();

  if (RANK[env.capability] < RANK[needed]) {
    throw new Error(
      `Ce test exige le niveau "${needed}" mais l'environnement "${env.name}" ` +
      `ne va pas au-delà de "${env.capability}". Lance-le avec TEST_ENV=test.`
    );
  }

  if (needed !== READ && env.requiresOptIn && process.env.ALLOW_PROD_WRITES !== '1') {
    throw new Error(
      `Écriture refusée sur l'environnement "${env.name}". ` +
      `Ces tests n'agissent que sur des comptes de test dédiés, mais l'accès reste ` +
      `explicite : relance avec ALLOW_PROD_WRITES=1.`
    );
  }

  return env;
}

/**
 * Confinement : refuse d'agir sur une ressource hors du périmètre de test.
 * Dernier rempart si un test tente d'écrire sur un compte de participant.
 */
export function assertScopedResource(email) {
  const env = currentEnvironment();

  if (!env.scopedEmailPattern.test(email)) {
    throw new Error(
      `Refus d'agir sur "${email}" : cette adresse est hors du périmètre de test ` +
      `de l'environnement "${env.name}" (motif attendu : ${env.scopedEmailPattern}).`
    );
  }

  return email;
}

/** Conservé pour les tests d'écriture libre. */
export function requireWritable() {
  return requireCapability(FULL);
}
