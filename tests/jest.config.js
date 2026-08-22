export default {
  verbose: true,
  // testTimeout n'est pas reconnu dans un projet : il se règle au niveau racine.
  testTimeout: 30000,
  projects: [
    {
      displayName: 'api',
      testEnvironment: 'node',
      transform: {},
      testMatch: ['<rootDir>/api/**/*.test.js'],
      // Refuse de s'exécuter ailleurs que sur un environnement jetable.
      setupFilesAfterEnv: ['<rootDir>/helpers/guard-full.js'],
    },
    {
      displayName: 'scenarios',
      testEnvironment: 'node',
      transform: {},
      testMatch: ['<rootDir>/scenarios/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/helpers/guard-scoped.js'],
    },
    {
      displayName: 'prod',
      testEnvironment: 'node',
      transform: {},
      testMatch: ['<rootDir>/prod/**/*.test.js'],
    },
  ],
};
