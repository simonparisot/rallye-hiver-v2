import {
  evaluateParcoursAccess,
  forPlayers,
  resolveRequiredEnigmaIds,
  AccessContext,
} from '../parcoursAccess';
import { getAllEnigmasForAdmin } from '../dynamodb';

jest.mock('../dynamodb', () => ({
  getAllEnigmasForAdmin: jest.fn(),
  getAllTeamProgress: jest.fn(),
}));

const context = (solved: string[]): AccessContext => ({
  enigmasById: new Map([
    ['e1', { enigmaNumber: 1, title: 'Une', isActive: true }],
    ['e2', { enigmaNumber: 2, title: 'Deux', isActive: true }],
    ['e3', { enigmaNumber: 3, title: 'Trois', isActive: true }],
    ['e4', { enigmaNumber: 4, title: 'Secrète', isActive: false }],
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

  test('une seule intrigue cochée résolue suffit à ouvrir la tournée', () => {
    const parcours = { requiredEnigmaIds: ['e3', 'e1'] };

    expect(evaluateParcoursAccess(parcours, context([])).isUnlocked).toBe(false);
    expect(evaluateParcoursAccess(parcours, context(['e2'])).isUnlocked).toBe(false);
    expect(evaluateParcoursAccess(parcours, context(['e1'])).isUnlocked).toBe(true);
    expect(evaluateParcoursAccess(parcours, context(['e3'])).isUnlocked).toBe(true);
    expect(evaluateParcoursAccess(parcours, context(['e1', 'e3'])).isUnlocked).toBe(true);
  });

  test('requiredEnigmasCount ne joue aucun rôle dans la règle', () => {
    const parcours = { requiredEnigmaIds: ['e1', 'e2', 'e3'], requiredEnigmasCount: 3 };

    expect(evaluateParcoursAccess(parcours, context(['e2'])).isUnlocked).toBe(true);
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

  test('une intrigue supprimée est ignorée, et ne compte pas comme résolue', () => {
    const parcours = { requiredEnigmaIds: ['e1', 'disparue'] };

    expect(evaluateParcoursAccess(parcours, context([])).isUnlocked).toBe(false);
    const access = evaluateParcoursAccess(parcours, context(['e1']));
    expect(access.isUnlocked).toBe(true);
    expect(access.requiredEnigmas.map((e) => e.enigmaId)).toEqual(['e1']);
  });

  test('si toutes les intrigues cochées ont été supprimées, la tournée est ouverte', () => {
    const access = evaluateParcoursAccess({ requiredEnigmaIds: ['disparue', 'partie'] }, context([]));

    expect(access.isUnlocked).toBe(true);
    expect(access.requiredEnigmas).toEqual([]);
  });

  test('ne révèle pas le titre d\'une intrigue non publiée', () => {
    const access = evaluateParcoursAccess({ requiredEnigmaIds: ['e4', 'e1'] }, context(['e1']));

    // e1 résolue suffit à ouvrir ; le titre de e4 reste caché.
    expect(access.isUnlocked).toBe(true);
    expect(access.requiredEnigmas).toEqual([
      { enigmaId: 'e1', enigmaNumber: 1, title: 'Une', solved: true },
      { enigmaId: 'e4', enigmaNumber: 4, title: 'Intrigue à venir', solved: false },
    ]);
    expect(JSON.stringify(access)).not.toContain('Secrète');
  });
});

describe('forPlayers', () => {
  const tournee = { parcoursId: 'p', title: 'T', pdfUrl: 'https://x', correctPassword: 'Tartuffe' };

  test('retire le PDF et le mot de passe, et dit seulement s\'il existe', () => {
    expect(forPlayers(tournee)).toEqual({ parcoursId: 'p', title: 'T', hasPassword: true });
  });

  test('garde le PDF d\'une tournée ouverte, jamais le mot de passe', () => {
    const vue = forPlayers(tournee, { withPdf: true });
    expect(vue).toEqual({ parcoursId: 'p', title: 'T', pdfUrl: 'https://x', hasPassword: true });
    expect(JSON.stringify(vue)).not.toContain('Tartuffe');
  });

  test('une tournée sans mot de passe le signale', () => {
    expect(forPlayers({ parcoursId: 'p' }).hasPassword).toBe(false);
    expect(forPlayers({ parcoursId: 'p', correctPassword: '' }).hasPassword).toBe(false);
  });
});

describe('resolveRequiredEnigmaIds', () => {
  beforeEach(() => {
    (getAllEnigmasForAdmin as jest.Mock).mockResolvedValue([{ enigmaId: 'e1' }, { enigmaId: 'e2' }]);
  });

  test('refuse un identifiant inconnu et nouveau', async () => {
    const result = await resolveRequiredEnigmaIds(['e1', 'inventee'], ['e1']);
    expect(result.error).toBe('Intrigues inconnues : inventee');
  });

  test('retire sans erreur une intrigue supprimée qui était déjà requise', async () => {
    const result = await resolveRequiredEnigmaIds(['e1', 'disparue'], ['e1', 'disparue']);
    expect(result).toEqual({ error: null, ids: ['e1'] });
  });

  test('une liste vide ne consulte pas les intrigues', async () => {
    expect(await resolveRequiredEnigmaIds([])).toEqual({ error: null, ids: [] });
    expect(getAllEnigmasForAdmin).not.toHaveBeenCalled();
  });

  test('refuse autre chose qu\'une liste de chaînes', async () => {
    expect((await resolveRequiredEnigmaIds('e1')).error).toMatch(/liste/);
  });
});
