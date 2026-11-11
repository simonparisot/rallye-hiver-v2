jest.mock('../dynamodb', () => ({
  getGameStatus: jest.fn(),
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
}));

import * as db from '../dynamodb';
import {
  calculerPhase,
  dateLancement,
  DATE_LANCEMENT_PAR_DEFAUT,
  lireEtatJeu,
  phasePourEquipe,
  phasePourUtilisateur,
  intrigueOuverte,
  themeOfficielDebloque,
  idsPreliminaires,
  sansPreliminaires,
} from '../gamePhase';

const AVANT = new Date('2026-11-11T12:00:00+01:00');
const JUSTE_AVANT = new Date('2026-12-21T21:49:59+01:00');
const A_L_HEURE = new Date('2026-12-21T21:50:00+01:00');

describe('calcul de la phase', () => {
  test('la date par défaut est celle de l\'édition 2027', () => {
    expect(DATE_LANCEMENT_PAR_DEFAUT).toBe('2026-12-21T21:50:00+01:00');
    expect(dateLancement(undefined)).toBe(DATE_LANCEMENT_PAR_DEFAUT);
    expect(dateLancement({ launchAt: 'pas une date' })).toBe(DATE_LANCEMENT_PAR_DEFAUT);
    expect(dateLancement({ launchAt: '2027-01-05T20:00:00.000Z' })).toBe('2027-01-05T20:00:00.000Z');
  });

  test('item absent : avant-lancement jusqu\'à l\'heure dite, lancé à l\'heure pile', () => {
    expect(calculerPhase(undefined, AVANT)).toBe('avant-lancement');
    expect(calculerPhase(undefined, JUSTE_AVANT)).toBe('avant-lancement');
    expect(calculerPhase(undefined, A_L_HEURE)).toBe('lance');
  });

  test('isStarted lance le jeu avant l\'heure', () => {
    expect(calculerPhase({ isStarted: true }, AVANT)).toBe('lance');
    expect(calculerPhase({ isStarted: false }, AVANT)).toBe('avant-lancement');
  });

  test('isStarted faux ne retient pas le jeu une fois l\'heure passée', () => {
    expect(calculerPhase({ isStarted: false }, A_L_HEURE)).toBe('lance');
  });

  test('une heure repoussée (launchAt) prolonge l\'avant-lancement', () => {
    const statut = { isStarted: false, launchAt: '2027-01-05T20:00:00.000Z' };
    expect(calculerPhase(statut, A_L_HEURE)).toBe('avant-lancement');
    expect(calculerPhase(statut, new Date('2027-01-05T20:00:00.000Z'))).toBe('lance');
  });

  test('lireEtatJeu lit l\'item de statut', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: true, startedAt: '2026-11-01T10:00:00.000Z' });
    await expect(lireEtatJeu(AVANT)).resolves.toEqual({
      phase: 'lance',
      launchAt: DATE_LANCEMENT_PAR_DEFAUT,
      isStarted: true,
      startedAt: '2026-11-01T10:00:00.000Z',
    });

    (db.getGameStatus as jest.Mock).mockResolvedValue(undefined);
    await expect(lireEtatJeu(AVANT)).resolves.toEqual({
      phase: 'avant-lancement',
      launchAt: DATE_LANCEMENT_PAR_DEFAUT,
      isStarted: false,
      startedAt: null,
    });
  });
});

describe('phase par équipe', () => {
  test('une équipe bêta voit le jeu lancé', () => {
    expect(phasePourEquipe('avant-lancement', { isBetaTeam: true })).toBe('lance');
    expect(phasePourEquipe('avant-lancement', { isBetaTeam: false })).toBe('avant-lancement');
    expect(phasePourEquipe('avant-lancement', null)).toBe('avant-lancement');
    expect(phasePourEquipe('lance', null)).toBe('lance');
  });

  test('phasePourUtilisateur ne lit l\'équipe qu\'avant le lancement', async () => {
    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: true });
    await expect(phasePourUtilisateur('u1')).resolves.toBe('lance');
    expect(db.getUserById).not.toHaveBeenCalled();

    (db.getGameStatus as jest.Mock).mockResolvedValue({ isStarted: false, launchAt: '2099-01-01T00:00:00Z' });
    (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
    (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', isBetaTeam: true });
    await expect(phasePourUtilisateur('u1')).resolves.toBe('lance');

    (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1' });
    await expect(phasePourUtilisateur('u1')).resolves.toBe('avant-lancement');
    await expect(phasePourUtilisateur(undefined)).resolves.toBe('avant-lancement');
  });
});

describe('intrigues et thème', () => {
  test('préliminaires avant le lancement, vraies intrigues après', () => {
    expect(intrigueOuverte({ isPreliminary: true }, 'avant-lancement')).toBe(true);
    expect(intrigueOuverte({ isPreliminary: true }, 'lance')).toBe(false);
    expect(intrigueOuverte({ isPreliminary: false }, 'avant-lancement')).toBe(false);
    expect(intrigueOuverte({}, 'avant-lancement')).toBe(false);
    expect(intrigueOuverte({}, 'lance')).toBe(true);
  });

  test('themeOfficiel : jeu lancé, ou préliminaire résolue', () => {
    expect(themeOfficielDebloque('lance', null)).toBe(true);
    expect(themeOfficielDebloque('avant-lancement', null)).toBe(false);
    expect(themeOfficielDebloque('avant-lancement', {})).toBe(false);
    expect(themeOfficielDebloque('avant-lancement', { themeUnlockedAt: '2026-11-11T10:00:00.000Z' })).toBe(true);
  });

  test('les lignes portant sur une préliminaire sont retirées', () => {
    const prelims = idsPreliminaires([
      { enigmaId: 'p1', isPreliminary: true },
      { enigmaId: 'e1' },
    ]);
    expect([...prelims]).toEqual(['p1']);
    expect(sansPreliminaires([{ enigmaId: 'p1' }, { enigmaId: 'e1' }, {}], prelims)).toEqual([
      { enigmaId: 'e1' },
      {},
    ]);
  });
});
