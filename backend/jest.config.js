/**
 * Tests unitaires du backend.
 *
 * Ils ne touchent ni AWS ni l'API du modele : tout ce qui sort du processus est
 * remplace par un faux. Les tests qui parlent a l'API deployee vivent dans
 * `tests/`, a la racine du depot.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
};
