import { evaluateParcoursAccess, withoutPdf, AccessContext } from '../parcoursAccess';

const context = (solved: string[]): AccessContext => ({
  enigmasById: new Map([
    ['e1', { enigmaNumber: 1, title: 'Une' }],
    ['e2', { enigmaNumber: 2, title: 'Deux' }],
    ['e3', { enigmaNumber: 3, title: 'Trois' }],
  ]),
  solvedEnigmaIds: new Set(solved),
});

describe('evaluateParcoursAccess', () => {
  test('sans intrigue requise, la tournée est ouverte', () => {
    expect(evaluateParcoursAccess({ requiredEnigmaIds: [] }, context([])).isUnlocked).toBe(true);
  });

  test('un enregistrement ancien sans liste est ouvert aussi', () => {
    expect(evaluateParcoursAccess({}, context([])).isUnlocked).toBe(true);
  });

  test('toutes les intrigues cochées doivent être résolues', () => {
    const parcours = { requiredEnigmaIds: ['e3', 'e1'] };

    expect(evaluateParcoursAccess(parcours, context(['e1'])).isUnlocked).toBe(false);
    expect(evaluateParcoursAccess(parcours, context(['e1', 'e3'])).isUnlocked).toBe(true);
  });

  test('détaille les intrigues requises, dans l\'ordre du rallye', () => {
    const { requiredEnigmas } = evaluateParcoursAccess(
      { requiredEnigmaIds: ['e3', 'e1'] },
      context(['e3'])
    );

    expect(requiredEnigmas).toEqual([
      { enigmaId: 'e1', enigmaNumber: 1, title: 'Une', solved: false },
      { enigmaId: 'e3', enigmaNumber: 3, title: 'Trois', solved: true },
    ]);
  });

  test('une intrigue supprimée ne verrouille pas la tournée pour toujours', () => {
    const access = evaluateParcoursAccess({ requiredEnigmaIds: ['e1', 'disparue'] }, context(['e1']));

    expect(access.isUnlocked).toBe(true);
    expect(access.requiredEnigmas.map((e) => e.enigmaId)).toEqual(['e1']);
  });
});

test('withoutPdf retire l\'adresse du PDF et rien d\'autre', () => {
  expect(withoutPdf({ parcoursId: 'p', title: 'T', pdfUrl: 'https://x' })).toEqual({
    parcoursId: 'p',
    title: 'T',
  });
});
