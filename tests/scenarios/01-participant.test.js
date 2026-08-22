import { describe, test, expect, beforeAll } from '@jest/globals';
import axios from 'axios';
import { asLeader } from '../helpers/users.js';
import { config } from '../config/test-config.js';

/**
 * Parcours d'un membre déjà inscrit dans une équipe, rallye en cours.
 * Couvre les scénarios 1, 2, 3, 7, 8 et 9.
 *
 * Aucun de ces tests n'écrit quoi que ce soit : ils sont rejouables à l'infini,
 * en test comme en production.
 */
describe('Membre d\'une équipe', () => {
  let membre;

  beforeAll(async () => {
    membre = await asLeader();
  });

  describe('1. Authentification', () => {
    test('ouvre une session et rattache le membre à son équipe', async () => {
      const profil = await membre.get('/auth/me');

      expect(profil.status).toBe(200);
      expect(profil.data.teamId).toBe(config.teamId);
      expect(['leader', 'member']).toContain(profil.data.role);
    });

    test('donne accès au contenu du rallye', async () => {
      const acces = await membre.get('/content/check-access');

      expect(acces.status).toBe(200);
      expect(acces.data.hasAccess).toBe(true);
    });
  });

  describe('2. Affichage d\'une énigme', () => {
    test('liste les énigmes du rallye', async () => {
      const liste = await membre.get('/enigmas');

      expect(liste.status).toBe(200);
      expect(Array.isArray(liste.data.enigmas)).toBe(true);
      expect(liste.data.enigmas.length).toBeGreaterThan(0);

      const enigme = liste.data.enigmas[0];
      expect(enigme).toHaveProperty('enigmaId');
      expect(enigme).toHaveProperty('enigmaNumber');
      expect(enigme).toHaveProperty('title');
      expect(enigme).toHaveProperty('pdfUrl');
    });

    test('affiche le détail d\'une énigme', async () => {
      const liste = await membre.get('/enigmas');
      const premiere = liste.data.enigmas[0];

      const detail = await membre.get(`/enigmas/${premiere.enigmaId}`);
      const enigme = detail.data.enigma ?? detail.data;

      expect(detail.status).toBe(200);
      expect(enigme.enigmaId).toBe(premiere.enigmaId);
      expect(enigme.title).toBe(premiere.title);
    });

    test('ne divulgue jamais la solution', async () => {
      const liste = await membre.get('/enigmas');
      const detail = await membre.get(`/enigmas/${liste.data.enigmas[0].enigmaId}`);

      expect(JSON.stringify(liste.data)).not.toContain('correctPassword');
      expect(JSON.stringify(detail.data)).not.toContain('correctPassword');
    });
  });

  describe('3. Affichage d\'un parcours', () => {
    test('liste les parcours du rallye', async () => {
      const liste = await membre.get('/parcours');

      expect(liste.status).toBe(200);
      expect(Array.isArray(liste.data.parcours)).toBe(true);
      expect(liste.data.parcours.length).toBeGreaterThan(0);

      const parcours = liste.data.parcours[0];
      expect(parcours).toHaveProperty('parcoursId');
      expect(parcours).toHaveProperty('parcoursNumber');
      expect(parcours).toHaveProperty('pdfUrl');
      expect(parcours).toHaveProperty('requiredEnigmasCount');
    });

    test('indique les parcours accessibles à l\'équipe', async () => {
      const accessibles = await membre.get('/progress/parcours');

      expect(accessibles.status).toBe(200);
      expect(accessibles.data.teamId).toBe(config.teamId);
      expect(Array.isArray(accessibles.data.accessibleParcours)).toBe(true);
    });
  });

  describe('7. Téléchargement d\'une énigme', () => {
    test('le PDF de l\'énigme est téléchargeable par le membre', async () => {
      const liste = await membre.get('/enigmas');
      const { pdfUrl } = liste.data.enigmas[0];

      const pdf = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        validateStatus: () => true,
      });

      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toMatch(/pdf/);
      expect(pdf.data.byteLength).toBeGreaterThan(1000);
      // Signature d'un fichier PDF valide.
      expect(Buffer.from(pdf.data).subarray(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('8. Téléchargement d\'un parcours', () => {
    test('le PDF du parcours est téléchargeable par le membre', async () => {
      const liste = await membre.get('/parcours');
      const { pdfUrl } = liste.data.parcours[0];

      const pdf = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        validateStatus: () => true,
      });

      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toMatch(/pdf/);
      expect(Buffer.from(pdf.data).subarray(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('9. Statistiques du tableau de bord', () => {
    test('expose les compteurs de l\'équipe', async () => {
      const stats = await membre.get('/teams/stats');

      expect(stats.status).toBe(200);
      expect(stats.data.teamName).toEqual(expect.any(String));
      expect(stats.data.memberCount).toBeGreaterThanOrEqual(1);

      // Énigmes testées, parcours réalisés, tentatives de mot de passe.
      expect(typeof stats.data.enigmasSolved).toBe('number');
      expect(typeof stats.data.totalEnigmas).toBe('number');
      expect(typeof stats.data.parcoursCompleted).toBe('number');
      expect(typeof stats.data.totalParcours).toBe('number');
      expect(typeof stats.data.passwordAttemptsCount).toBe('number');
    });

    test('les compteurs restent cohérents entre eux', async () => {
      const stats = await membre.get('/teams/stats');

      expect(stats.data.enigmasSolved).toBeLessThanOrEqual(stats.data.totalEnigmas);
      expect(stats.data.parcoursCompleted).toBeLessThanOrEqual(stats.data.totalParcours);
      expect(stats.data.enigmasSolved).toBeGreaterThanOrEqual(0);
      expect(stats.data.passwordAttemptsCount).toBeGreaterThanOrEqual(0);
    });

    test('la progression détaillée porte sur l\'équipe du membre', async () => {
      const progression = await membre.get('/progress');

      expect(progression.status).toBe(200);
      expect(progression.data.teamId).toBe(config.teamId);
      expect(Array.isArray(progression.data.progress)).toBe(true);
      expect(typeof progression.data.totalSolved).toBe('number');
    });
  });
});
