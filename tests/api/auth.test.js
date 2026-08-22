import { describe, test, expect, beforeAll } from '@jest/globals';
import APIClient from '../helpers/api-client.js';
import { createEphemeralUser, uniqueEmail, registerForCleanup } from '../helpers/users.js';
import { config } from '../config/test-config.js';

/**
 * Authentification : inscription, connexion, jeton, session.
 *
 * Les cas marqués `test.failing` décrivent le comportement attendu d'une API
 * correcte ; ils resteront « attendus en échec » jusqu'à ce que le handler soit
 * corrigé, et signaleront d'eux-mêmes la correction en devenant rouges.
 */
describe('Authentification', () => {
  let anon;

  beforeAll(() => {
    anon = new APIClient({ label: 'anonyme' });
  });

  describe('Inscription', () => {
    test('crée un compte et renvoie son identifiant', async () => {
      const email = uniqueEmail('signup');

      const response = await anon.post('/auth/signup', {
        email,
        password: config.ephemeralPassword,
        displayName: 'Nouvel inscrit',
      });

      registerForCleanup(email, response.data.user?.userId);

      expect(response.status).toBe(201);
      expect(response.data.user).toMatchObject({ email, displayName: 'Nouvel inscrit' });
      expect(typeof response.data.user.userId).toBe('string');
    });

    test('refuse une inscription incomplète', async () => {
      const response = await anon.post('/auth/signup', {});

      expect(response.status).toBe(400);
      expect(response.data.error).toMatch(/required/i);
    });

    test.failing('[défaut connu] refuse un mot de passe trop faible avec un statut 400', async () => {
      const response = await anon.post('/auth/signup', {
        email: uniqueEmail(),
        password: 'abc',
        displayName: 'Mot de passe faible',
      });

      // Une saisie invalide relève du client, pas d'une panne serveur.
      expect(response.status).toBe(400);
    });

    test.failing('[défaut connu] refuse une adresse déjà utilisée avec un statut 409', async () => {
      const response = await anon.post('/auth/signup', {
        email: config.fixtureUsers.leader.email,
        password: config.ephemeralPassword,
        displayName: 'Doublon',
      });

      expect(response.status).toBe(409);
    });
  });

  describe('Connexion', () => {
    test('authentifie un compte valide et renvoie trois jetons', async () => {
      const response = await anon.post('/auth/login', {
        email: config.fixtureUsers.leader.email,
        password: config.fixtureUsers.leader.password,
      });

      expect(response.status).toBe(200);
      for (const token of ['accessToken', 'refreshToken', 'idToken']) {
        expect(typeof response.data[token]).toBe('string');
        expect(response.data[token].length).toBeGreaterThan(0);
      }
      expect(response.data.user.email).toBe(config.fixtureUsers.leader.email);
    });

    test('ne renvoie jamais le mot de passe', async () => {
      const response = await anon.post('/auth/login', {
        email: config.fixtureUsers.leader.email,
        password: config.fixtureUsers.leader.password,
      });

      expect(JSON.stringify(response.data)).not.toContain(config.fixtureUsers.leader.password);
    });

    test('rejette un mot de passe incorrect', async () => {
      const response = await anon.post('/auth/login', {
        email: config.fixtureUsers.leader.email,
        password: 'MauvaisMotDePasse!9',
      });

      expect(response.status).toBe(401);
    });

    test('refuse une requête sans identifiants', async () => {
      const response = await anon.post('/auth/login', {});

      expect(response.status).toBe(400);
    });

    test.failing('[défaut connu] rejette un compte inexistant avec un statut 401', async () => {
      const response = await anon.post('/auth/login', {
        email: 'compte-absent@rallyehiver.fr',
        password: 'Quelconque!9',
      });

      expect(response.status).toBe(401);
    });

    test.failing('[défaut connu] ne permet pas de distinguer un compte inexistant d\'un mot de passe erroné', async () => {
      const inconnu = await anon.post('/auth/login', {
        email: 'compte-absent@rallyehiver.fr',
        password: 'Quelconque!9',
      });
      const mauvaisMdp = await anon.post('/auth/login', {
        email: config.fixtureUsers.leader.email,
        password: 'MauvaisMotDePasse!9',
      });

      // Deux réponses différentes permettent d'énumérer les comptes existants.
      expect(inconnu.status).toBe(mauvaisMdp.status);
      expect(inconnu.data.error).toBe(mauvaisMdp.data.error);
    });
  });

  describe('Session', () => {
    test('refuse /auth/me sans jeton', async () => {
      const response = await anon.get('/auth/me');

      expect(response.status).toBe(401);
    });

    test('refuse /auth/me avec un jeton invalide', async () => {
      const response = await anon.get('/auth/me', { Authorization: 'Bearer jeton-invalide' });

      expect(response.status).toBe(401);
    });

    test('renvoie le profil du porteur du jeton', async () => {
      const { client, email } = await createEphemeralUser({ label: 'session' });

      const response = await client.get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.data.email).toBe(email);
      expect(response.data).toHaveProperty('teamId', null);
      expect(response.data).toHaveProperty('role', null);
    });
  });
});
