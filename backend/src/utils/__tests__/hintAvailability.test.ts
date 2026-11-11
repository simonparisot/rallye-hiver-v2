import { indicesOuverts, lireReglageIndices } from '../hintAvailability';

describe('indicesOuverts', () => {
  // 11 janvier 2027, 23 h 30 à Paris = 22 h 30 UTC : encore le 11 à Paris.
  const veilleAParis = new Date('2027-01-11T22:30:00Z');
  // 11 janvier 2027, 23 h 30 UTC = 0 h 30 le 12 à Paris.
  const lendemainAParis = new Date('2027-01-11T23:30:00Z');

  it('est fermé par défaut, quand rien n\'a été réglé', () => {
    expect(indicesOuverts({})).toBe(false);
  });

  it("est fermé quand l'organisateur l'a fermé, même avec une date passée", () => {
    expect(indicesOuverts({ hintsEnabled: false, hintsAvailableFrom: '2000-01-01' })).toBe(false);
  });

  it('est ouvert tout de suite sans date', () => {
    expect(indicesOuverts({ hintsEnabled: true })).toBe(true);
    expect(indicesOuverts({ hintsEnabled: true, hintsAvailableFrom: null })).toBe(true);
    expect(indicesOuverts({ hintsEnabled: true, hintsAvailableFrom: '' })).toBe(true);
  });

  it("s'ouvre à minuit, heure de Paris, le jour indiqué", () => {
    const reglage = { hintsEnabled: true, hintsAvailableFrom: '2027-01-12' };
    expect(indicesOuverts(reglage, veilleAParis)).toBe(false);
    expect(indicesOuverts(reglage, lendemainAParis)).toBe(true);
  });
});

describe('lireReglageIndices', () => {
  it('ne touche à rien quand les champs sont absents', () => {
    expect(lireReglageIndices({})).toEqual({ valeurs: {} });
  });

  it('accepte un interrupteur et une date valides', () => {
    expect(lireReglageIndices({ hintsEnabled: true, hintsAvailableFrom: '2027-01-12' }))
      .toEqual({ valeurs: { hintsEnabled: true, hintsAvailableFrom: '2027-01-12' } });
  });

  it('efface la date quand elle est vidée', () => {
    expect(lireReglageIndices({ hintsAvailableFrom: '' }).valeurs.hintsAvailableFrom).toBeNull();
    expect(lireReglageIndices({ hintsAvailableFrom: null }).valeurs.hintsAvailableFrom).toBeNull();
  });

  it('refuse une date mal formée plutôt que de la stocker', () => {
    expect(lireReglageIndices({ hintsAvailableFrom: '12/01/2027' }).erreur).toBeDefined();
    expect(lireReglageIndices({ hintsAvailableFrom: '2027-13-45' }).erreur).toBeDefined();
  });

  it('refuse un interrupteur qui n\'est pas un booléen', () => {
    expect(lireReglageIndices({ hintsEnabled: 'oui' }).erreur).toBeDefined();
  });
});
