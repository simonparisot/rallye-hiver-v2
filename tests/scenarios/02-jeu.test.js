import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { asLeader } from '../helpers/users.js';
import { enigmaWithSolution } from '../helpers/enigmas.js';
import { parcoursPasswords } from '../helpers/parcours.js';
import { resetTestTeamProgress } from '../helpers/cleanup.js';
import { config } from '../config/test-config.js';

/**
 * Cœur du jeu : soumission de mot de passe et validation de parcours.
 * Couvre les scénarios 4, 5 et 6.
 *
 * Ces tests écrivent. Toutes leurs traces — tentatives (intrigues et
 * tournées), progression, accès aux parcours, compteurs d'équipe — sont effacées à la fin, afin que le run soit
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

  describe('6. Validation d\'un parcours par son mot de passe', () => {
    // Tournée ouverte pour l'équipe et dotée d'un mot de passe, lu en base.
    let tournee;

    beforeAll(async () => {
      const [{ data }, motsDePasse] = await Promise.all([
        membre.get('/progress/parcours'),
        parcoursPasswords(),
      ]);
      const candidate = data.accessibleParcours.find(
        (p) => p.hasPassword && !p.completed && motsDePasse.has(p.parcoursId)
      );
      if (candidate) {
        tournee = { parcoursId: candidate.parcoursId, motDePasse: motsDePasse.get(candidate.parcoursId) };
      }
    });

    // Aucune tournée ouverte avec mot de passe pour l'équipe dans ce décor :
    // on n'appelle pas /parcours/undefined/..., on le dit et on passe.
    const sansTourneeOuverte = () => {
      if (tournee) return false;
      console.warn(
        'Scénario 6 ignoré : aucune tournée ouverte, non réalisée et dotée d\'un mot de passe pour l\'équipe de test.'
      );
      return true;
    };

    test('ne donne jamais le mot de passe d\'une tournée aux joueurs', async () => {
      const liste = await membre.get('/parcours');
      const equipe = await membre.get('/progress/parcours');

      expect(JSON.stringify(liste.data)).not.toContain('correctPassword');
      expect(JSON.stringify(equipe.data)).not.toContain('correctPassword');
      equipe.data.parcours.forEach((p) => expect(typeof p.hasPassword).toBe('boolean'));
    });

    test('refuse de valider un parcours verrouillé', async () => {
      const { data } = await membre.get('/progress/parcours');
      const verrouille = data.parcours.find((p) => !p.isUnlocked);
      if (!verrouille) {
        console.warn('Scénario 6 : aucune tournée verrouillée pour l\'équipe dans ce décor, vérification ignorée.');
        return;
      }

      const reponse = await membre.post(`/parcours/${verrouille.parcoursId}/attempt`, { password: 'peu importe' });

      expect(reponse.status).toBe(403);
    });

    test('rejette une tentative sans mot de passe', async () => {
      if (sansTourneeOuverte()) return;
      const reponse = await membre.post(`/parcours/${tournee.parcoursId}/attempt`, {});

      expect(reponse.status).toBe(400);
    });

    test('un mot de passe faux ne valide pas la tournée', async () => {
      if (sansTourneeOuverte()) return;
      const reponse = await membre.post(`/parcours/${tournee.parcoursId}/attempt`, {
        password: 'reponse-volontairement-fausse-42',
      });

      expect(reponse.status).toBe(200);
      expect(reponse.data.success).toBe(false);
      expect(reponse.data.message.toLowerCase()).not.toContain(tournee.motDePasse.toLowerCase());

      const { data } = await membre.get('/progress/parcours');
      expect(data.parcours.find((p) => p.parcoursId === tournee.parcoursId).completed).toBe(false);
    });

    test('le bon mot de passe, saisi librement, valide la tournée', async () => {
      if (sansTourneeOuverte()) return;
      // Même tolérance que pour les intrigues : casse, accents, espaces.
      const variante = tournee.motDePasse.toLowerCase().split('').join(' ');

      const reponse = await membre.post(`/parcours/${tournee.parcoursId}/attempt`, { password: variante });

      expect(reponse.status).toBe(200);
      expect(reponse.data.success).toBe(true);
      expect(reponse.data.alreadyCompleted).toBe(false);

      const { data } = await membre.get('/progress/parcours');
      const suivi = data.parcours.find((p) => p.parcoursId === tournee.parcoursId);
      expect(suivi.completed).toBe(true);
      expect(suivi.completedAt).toEqual(expect.any(String));
    });

    test('reporte le parcours réalisé sur le tableau de bord', async () => {
      if (sansTourneeOuverte()) return;
      const stats = await membre.get('/teams/stats');

      expect(stats.data.parcoursCompleted).toBeGreaterThanOrEqual(1);
    });

    test('reste juste sur une tournée déjà validée, sans revalider', async () => {
      if (sansTourneeOuverte()) return;
      const reponse = await membre.post(`/parcours/${tournee.parcoursId}/attempt`, { password: tournee.motDePasse });

      expect(reponse.data.success).toBe(true);
      expect(reponse.data.alreadyCompleted).toBe(true);
    });

    // Plus de retour arrière côté joueur : la remise à zéro de afterAll
    // (resetTestTeamProgress) efface la validation et les tentatives.
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
