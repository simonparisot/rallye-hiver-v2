/**
 * Tests unitaires du backend.
 *
 * Ils ne touchent ni AWS ni l'API du modèle : tout ce qui sort du processus
 * est remplacé par un faux. Ils couvrent la logique pure (machine à états du
 * jeu de l'oie, choix d'indice, worker). Les tests qui parlent à l'API
 * déployée vivent dans `tests/`, à la racine du dépôt.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
};
