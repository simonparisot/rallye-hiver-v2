import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import APIClient from '../helpers/api-client.js';
import { asAdmin, asLeader } from '../helpers/users.js';
import { config } from '../config/test-config.js';

/**
 * Jeu de l'oie (édition 2027) : contrat de l'API du plateau partagé.
 *
 * Deux familles de tests, séparées à dessein.
 *
 * Les premières ne laissent aucune trace : forme de la réponse de `GET /oie`,
 * refus opposés à un visiteur anonyme, refus opposés à une action impossible.
 * Elles tournent toujours.
 *
 * La seconde joue vraiment un lancer, et consomme donc le quota quotidien de
 * l'équipe de test. Elle n'est exécutée que si un compte d'administration est
 * configuré, parce qu'il faut pouvoir remettre l'équipe à zéro avant et après :
 * un test qui laisserait l'équipe bloquée jusqu'au lendemain rendrait la suite
 * non rejouable.
 */
describe('Jeu de l\'oie', () => {
  let joueur;
  let anonyme;
  let admin = null;

  beforeAll(async () => {
    joueur = await asLeader();
    anonyme = new APIClient({ label: 'anonyme' });

    try {
      const client = await asAdmin();
      const verification = await client.get('/admin/auth/verify');
      if (verification.ok) admin = client;
    } catch {
      // Pas de compte d'administration configuré : les tests qui écrivent
      // seront ignorés plutôt que de laisser l'équipe dans un état non rejouable.
      admin = null;
    }
  });

  describe('Lecture du plateau', () => {
    test('refuse un visiteur anonyme', async () => {
      const reponse = await anonyme.get('/oie');

      expect(reponse.status).toBe(401);
    });

    test('renvoie les 64 cases, sans question ni réponse', async () => {
      const reponse = await joueur.get('/oie');

      expect(reponse.status).toBe(200);
      expect(reponse.data.board.squares).toHaveLength(64);

      const numeros = reponse.data.board.squares.map((case_) => case_.squareNumber);
      expect(numeros[0]).toBe(0);
      expect(numeros[63]).toBe(63);

      // Le contenu des questions ne doit jamais circuler pour les autres cases :
      // une équipe pourrait sinon préparer tout le plateau à l'avance.
      reponse.data.board.squares.forEach((case_) => {
        expect(case_).not.toHaveProperty('question');
        expect(case_).not.toHaveProperty('acceptedAnswers');
        expect(case_).not.toHaveProperty('hint');
      });
    });

    test('place les cases spéciales du théâtre là où elles doivent être', async () => {
      const reponse = await joueur.get('/oie');
      const type = (numero) =>
        reponse.data.board.squares.find((case_) => case_.squareNumber === numero).type;

      [9, 18, 27, 36, 45, 54].forEach((numero) => expect(type(numero)).toBe('oie'));
      [14, 39, 50, 60].forEach((numero) => expect(type(numero)).toBe('souffleur'));
      expect(type(19)).toBe('loge');
      expect(type(31)).toBe('puits');
      expect(type(52)).toBe('prison');
      expect(type(58)).toBe('mort');
      expect(type(63)).toBe('arrivee');
    });

    test('décrit l\'état de mon équipe et le quota du jour', async () => {
      const reponse = await joueur.get('/oie');

      expect(reponse.data.me).toMatchObject({
        teamId: expect.any(String),
        position: expect.any(Number),
        questionPending: expect.any(Boolean),
        canRoll: expect.any(Boolean),
        rollsRemainingToday: expect.any(Number),
        rollsPerDay: expect.any(Number),
      });

      expect(reponse.data.me.position).toBeGreaterThanOrEqual(0);
      expect(reponse.data.me.position).toBeLessThanOrEqual(63);
      expect(['question_en_attente', 'peut_lancer', 'quota_epuise', 'tour_passe', 'dans_le_puits', 'arrivee'])
        .toContain(reponse.data.me.status);
    });

    test('montre la position des équipes et le fil d\'événements', async () => {
      const reponse = await joueur.get('/oie');

      expect(Array.isArray(reponse.data.teams)).toBe(true);
      expect(Array.isArray(reponse.data.events)).toBe(true);

      // Mon équipe est toujours présente sur le plateau, même à la case 0.
      expect(reponse.data.teams.some((equipe) => equipe.isMine)).toBe(true);

      // Le fil raconte ce qui se passe, jamais ce que les autres répondent.
      reponse.data.events.forEach((evenement) => {
        expect(evenement).toHaveProperty('message');
        expect(evenement).not.toHaveProperty('detail');
      });
    });
  });

  describe('Refus sans effet de bord', () => {
    test('un visiteur anonyme ne peut ni répondre ni lancer', async () => {
      expect((await anonyme.post('/oie/answer', { answer: 'x' })).status).toBe(401);
      expect((await anonyme.post('/oie/roll')).status).toBe(401);
      expect((await anonyme.post('/oie/prompter')).status).toBe(401);
    });

    test('une réponse vide est refusée', async () => {
      const reponse = await joueur.post('/oie/answer', { answer: '   ' });

      expect(reponse.status).toBe(400);
    });

    test('répondre sans question en attente est refusé', async () => {
      const plateau = await joueur.get('/oie');

      if (plateau.data.me.questionPending) {
        // L'équipe a une question en cours : ce cas n'est pas testable ici sans
        // modifier son état, ce que ce bloc s'interdit.
        return;
      }

      const reponse = await joueur.post('/oie/answer', { answer: 'peu importe' });

      expect(reponse.status).toBe(400);
      expect(reponse.data.error).toMatch(/question/i);
    });

    test('le souffleur refuse une case qui n\'a pas d\'indice', async () => {
      const plateau = await joueur.get('/oie');
      const maCase = plateau.data.board.squares.find(
        (case_) => case_.squareNumber === plateau.data.me.position
      );

      if (maCase.hasHint) return; // l'équipe est sur une case du souffleur

      const reponse = await joueur.post('/oie/prompter');

      expect(reponse.status).toBe(404);
    });
  });

  describe('Cloisonnement du back-office', () => {
    test('un participant ordinaire n\'atteint aucun endpoint d\'administration du plateau', async () => {
      const lecturePlateau = await joueur.get('/admin/oie/board');
      const lectureEquipes = await joueur.get('/admin/oie/teams');

      expect(lecturePlateau.status).not.toBe(200);
      expect(lectureEquipes.status).not.toBe(200);
    });
  });

  describe('Une partie réelle', () => {
    /**
     * Ces tests consomment le quota quotidien : ils ne s'exécutent qu'avec un
     * compte d'administration, seul moyen de remettre l'équipe à zéro ensuite.
     */
    const avecAdmin = (nom, corps) =>
      test(nom, async () => {
        if (!admin) {
          console.warn(`[oie] ${nom} : ignoré, aucun compte d'administration configuré`);
          return;
        }
        await corps();
      });

    afterAll(async () => {
      if (!admin) return;
      const teamId = joueur.user?.teamId || config.teamId;
      if (teamId) await admin.post(`/admin/oie/teams/${teamId}/reset`);
    });

    avecAdmin('un lancer déplace l\'équipe et consomme un lancer du jour', async () => {
      const teamId = joueur.user?.teamId || config.teamId;
      await admin.post(`/admin/oie/teams/${teamId}/reset`);

      const avant = await joueur.get('/oie');

      if (!avant.data.me.canRoll) {
        console.warn('[oie] lancer ignoré : l\'équipe ne peut pas lancer après remise à zéro');
        return;
      }

      const lancer = await joueur.post('/oie/roll');

      expect(lancer.status).toBe(200);
      expect(lancer.data.dice).toHaveLength(2);
      lancer.data.dice.forEach((de) => {
        expect(de).toBeGreaterThanOrEqual(1);
        expect(de).toBeLessThanOrEqual(6);
      });
      expect(lancer.data.total).toBe(lancer.data.dice[0] + lancer.data.dice[1]);
      expect(lancer.data.from).toBe(0);
      expect(lancer.data.me.totalRolls).toBe(1);
      expect(lancer.data.me.rollsRemainingToday).toBe(
        Math.max(0, avant.data.me.rollsPerDay - 1)
      );
    });

    avecAdmin('un second lancer est refusé tant que le quota du jour est épuisé', async () => {
      const plateau = await joueur.get('/oie');

      // Le refus ne vaut que si le quota est bien à zéro et qu'aucune question
      // n'attend : sinon, c'est un autre motif de refus qui s'appliquerait.
      if (plateau.data.me.rollsRemainingToday > 0) return;

      const lancer = await joueur.post('/oie/roll');

      expect(lancer.status).toBe(400);
      expect(lancer.data.error).toMatch(/lancer|jour/i);
    });

    avecAdmin('une mauvaise réponse ne rend pas le droit de lancer', async () => {
      const plateau = await joueur.get('/oie');

      if (!plateau.data.me.questionPending) return;

      const reponse = await joueur.post('/oie/answer', {
        answer: 'reponse manifestement fausse 12345',
      });

      expect(reponse.status).toBe(200);
      expect(reponse.data.correct).toBe(false);
      expect(reponse.data.me.questionPending).toBe(true);
      expect(reponse.data.me.canRoll).toBe(false);
    });

    avecAdmin('la remise à zéro replace l\'équipe en case 0', async () => {
      const teamId = joueur.user?.teamId || config.teamId;
      const remise = await admin.post(`/admin/oie/teams/${teamId}/reset`);

      expect(remise.status).toBe(200);

      const plateau = await joueur.get('/oie');

      expect(plateau.data.me.position).toBe(0);
      expect(plateau.data.me.questionPending).toBe(false);
      expect(plateau.data.me.totalRolls).toBe(0);
    });
  });
});
