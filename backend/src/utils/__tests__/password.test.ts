import { normalizePassword, hasUsablePassword } from '../password';

describe('normalizePassword', () => {
  test('ignore la casse', () => {
    expect(normalizePassword('MolIERE')).toBe('moliere');
  });

  test('ignore les accents', () => {
    expect(normalizePassword('Molière à Pézenas, ça')).toBe('moliereapezenasca');
  });

  test('développe les ligatures', () => {
    expect(normalizePassword('cœur Æsope')).toBe('coeuraesope');
  });

  test('ignore espaces et ponctuation', () => {
    expect(normalizePassword("  l'Avare - acte\tII !\n")).toBe('lavareacteii');
  });

  test('garde les chiffres', () => {
    expect(normalizePassword('1673, Le Malade')).toBe('1673lemalade');
  });

  test('deux saisies équivalentes donnent la même forme', () => {
    expect(normalizePassword('Le Bourgeois gentilhomme')).toBe(normalizePassword('lebourgeois-GENTILHOMME.'));
  });
});

describe('hasUsablePassword', () => {
  test('un mot de passe ordinaire est utilisable', () => {
    expect(hasUsablePassword('Tartuffe')).toBe(true);
  });

  test('absent, vide ou réduit à de la ponctuation, il ne l\'est pas', () => {
    expect(hasUsablePassword(undefined)).toBe(false);
    expect(hasUsablePassword(null)).toBe(false);
    expect(hasUsablePassword('')).toBe(false);
    expect(hasUsablePassword('  - ! ')).toBe(false);
    expect(hasUsablePassword(42)).toBe(false);
  });
});
