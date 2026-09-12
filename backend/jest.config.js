/**
 * Tests unitaires du backend.
 *
 * Ils ne parlent a aucun service AWS : ils couvrent la logique pure, a
 * commencer par la machine a etats du jeu de l'oie. Les tests fonctionnels qui
 * appellent l'API deployee vivent dans tests/, a la racine du depot.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
