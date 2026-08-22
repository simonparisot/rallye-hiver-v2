import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { asLeader } from '../helpers/users.js';
import { enigmaWithSolution } from '../helpers/enigmas.js';
import { resetTestTeamProgress } from '../helpers/cleanup.js';
import { config } from '../config/test-config.js';

/**
 * Cœur du jeu : soumission de mot de passe et complétion de parcours.
 * Couvre les scénarios 4, 5 et 6.
 *
 * Ces tests écrivent. Toutes leurs traces — tentatives, progression, accès aux
 * parcours, compteurs d'équipe — sont effacées à la fin, afin que le run soit
 * rejouable et qu'il ne fausse pas les statistiques de difficulté en production.
 */
describe('Déroulement du jeu', () => {
  let membre;
  let enigme;

  beforeAll(async () => {
    membre = await asLeader();
    enigme = await enigmaWithSolution();

    // État de départ connu : l'énigme ne doit pas être déjà résolue.
    await resetTestTeamProgress();
  });

  afterAll(async () => {
    await resetTestTeamProgress();
  });

  describe('4. Mot de passe erroné', () => {
    test('refuse une réponse fausse sans résoudre l\'énigme', async () => {
      const reponse = await membre.post('/progress/attempt', {
        enigmaId: enigme.enigmaId,
        password: 'reponse-volontairement-fausse-42',
      });

      expect(reponse.status).toBe(200);
      expect(reponse.data.success).toBe(false);
      expect(typeof reponse.data.message).toBe('string');
      expect(reponse.data.message.length).toBeGreaterThan(0);
    });

    test('ne souffle jamais la solution dans le message d\'échec', async () => {
      const reponse = await membre.post('/progress/attempt', {
        enigmaId: enigme.enigmaId,
        password: 'encore-une-mauvaise-reponse',
      });

      const message = reponse.data.message.toLowerCase();
      expect(message).not.toContain(enigme.solution.toLowerCase());
    });

    test('comptabilise la tentative sans marquer l\'énigme résolue', async () => {
      const progression = await membre.get('/progress');
      const suivi = progression.data.progress.find((p) => p.enigmaId === enigme.enigmaId);

      expect(suivi).toBeDefined();
      expect(suivi.solved).toBe(false);
      expect(suivi.attemptCount).toBeGreaterThanOrEqual(2);
      expect(progression.data.totalSolved).toBe(0);
    });

    test('incrémente le compteur de tentatives du tableau de bord', async () => {
      const stats = await membre.get('/teams/stats');

      expect(stats.data.passwordAttemptsCount).toBeGreaterThanOrEqual(2);
      expect(stats.data.enigmasSolved).toBe(0);
    });

    test('rejette une soumission sans énigme ou sans mot de passe', async () => {
      const sansMotDePasse = await membre.post('/progress/attempt', { enigmaId: enigme.enigmaId });
      const sansEnigme = await membre.post('/progress/attempt', { password: 'peu importe' });

      expect(sansMotDePasse.status).toBe(400);
      expect(sansEnigme.status).toBe(400);
    });
  });

  describe('5. Mot de passe correct', () => {
    test('accepte la bonne réponse et résout l\'énigme', async () => {
      const reponse = await membre.post('/progress/attempt', {
        enigmaId: enigme.enigmaId,
        password: enigme.solution,
      });

      expect(reponse.status).toBe(200);
      expect(reponse.data.success).toBe(true);
      expect(reponse.data.message).toMatch(/bravo/i);
    });

    test('marque l\'énigme comme résolue dans la progression', async () => {
      const progression = await membre.get('/progress');
      const suivi = progression.data.progress.find((p) => p.enigmaId === enigme.enigmaId);

      expect(suivi.solved).toBe(true);
      expect(suivi.solvedAt).toEqual(expect.any(String));
      expect(progression.data.totalSolved).toBe(1);
    });

    test('reporte la résolution sur le tableau de bord', async () => {
      const stats = await membre.get('/teams/stats');

      expect(stats.data.enigmasSolved).toBe(1);
    });

    test('accepte la réponse quelles que soient casse, accents et espaces', async () => {
      // Le backend normalise la saisie : un participant ne doit pas être
      // pénalisé pour une majuscule ou un accent.
      const variante = enigme.solution.toUpperCase().split('').join(' ');

      const reponse = await membre.post('/progress/attempt', {
        enigmaId: enigme.enigmaId,
        password: variante,
      });

      expect(reponse.data.success).toBe(true);
    });

    test('reste correcte sur une énigme déjà résolue, sans double comptage', async () => {
      const avant = await membre.get('/teams/stats');

      const reponse = await membre.post('/progress/attempt', {
        enigmaId: enigme.enigmaId,
        password: enigme.solution,
      });

      const apres = await membre.get('/teams/stats');

      expect(reponse.data.success).toBe(true);
      expect(apres.data.enigmasSolved).toBe(avant.data.enigmasSolved);
    });
  });

  describe('6. Complétion d\'un parcours', () => {
    let parcoursId;

    beforeAll(async () => {
      const accessibles = await membre.get('/progress/parcours');
      const liste = accessibles.data.accessibleParcours?.length
        ? accessibles.data.accessibleParcours
        : (await membre.get('/parcours')).data.parcours;

      parcoursId = liste[0].parcoursId;
    });

    test('marque le parcours comme réalisé', async () => {
      const reponse = await membre.post(`/parcours/${parcoursId}/complete`, {});

      expect(reponse.status).toBe(200);
    });

    test('reporte le parcours réalisé sur le tableau de bord', async () => {
      const stats = await membre.get('/teams/stats');

      expect(stats.data.parcoursCompleted).toBeGreaterThanOrEqual(1);
    });

    test('permet de revenir sur la complétion', async () => {
      // Réversible : c'est ce qui rend ce scénario exécutable en production.
      const annulation = await membre.delete(`/parcours/${parcoursId}/complete`);

      expect(annulation.status).toBe(200);

      const stats = await membre.get('/teams/stats');
      expect(stats.data.parcoursCompleted).toBe(0);
    });
  });

  describe('Cloisonnement', () => {
    test('la progression renvoyée est bien celle de l\'équipe du membre', async () => {
      const progression = await membre.get('/progress');

      expect(progression.data.teamId).toBe(config.teamId);
      for (const suivi of progression.data.progress) {
        expect(suivi.teamId).toBe(config.teamId);
      }
    });
  });
});
