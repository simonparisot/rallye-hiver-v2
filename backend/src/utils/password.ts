/**
 * Comparaison des mots de passe saisis par les équipes, pour les intrigues
 * comme pour les tournées.
 *
 * Extrait tel quel de progress/submitAttempt.ts : le comportement n'a pas changé.
 */

/**
 * Normalize a password for comparison
 * - Converts to lowercase
 * - Removes all whitespace (spaces, tabs, newlines)
 * - Removes accents/diacritics (é→e, à→a, ç→c, etc.)
 * - Normalizes ligatures (œ→oe, æ→ae)
 * - Removes all punctuation and special characters
 * - Keeps only: a-z and 0-9
 */
export function normalizePassword(input: string): string {
  return input
    .toLowerCase()                     // 1. Convert to lowercase
    .normalize('NFD')                  // 2. Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')  // 3. Remove diacritics (accents)
    .replace(/œ/g, 'oe')              // 4. Normalize ligature œ
    .replace(/æ/g, 'ae')              // 5. Normalize ligature æ
    .replace(/\s+/g, '')              // 6. Remove all whitespace
    .replace(/[^a-z0-9]/g, '');       // 7. Keep only a-z and 0-9 (removes hyphens, punctuation, etc.)
}

/**
 * Un mot de passe attendu est-il défini ? Un mot de passe qui ne garde aucun
 * caractère une fois normalisé accepterait n'importe quelle ponctuation : il
 * compte comme absent.
 */
export function hasUsablePassword(expected: unknown): expected is string {
  return typeof expected === 'string' && normalizePassword(expected) !== '';
}
