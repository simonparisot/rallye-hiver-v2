import { describe, test, expect, beforeAll } from '@jest/globals';
import axios from 'axios';
import APIClient from '../helpers/api-client.js';
import { config, requireCapability, READ } from '../config/test-config.js';

/**
 * Santé de l'environnement, sans le moindre effet de bord.
 *
 * Ces tests ne créent, ne modifient et ne suppriment rien : ils sont donc sûrs
 * en production et peuvent tourner en continu, y compris comme contrôle
 * post-déploiement.
 */
describe(`Santé [${process.env.TEST_ENV || 'test'}]`, () => {
  let anon;

  beforeAll(() => {
    requireCapability(READ);
    anon = new APIClient({ label: 'sonde' });
  });

  describe('Site public', () => {
    test('répond et sert l\'application', async () => {
      const response = await axios.get(config.siteUrl, {
        timeout: 15000,
        validateStatus: () => true,
      });

      expect(response.status).toBe(200);
      expect(response.data).toContain('<div id="root">');
      expect(response.data).toContain('lang="fr"');
    });

    test('renvoie l\'application sur une URL inconnue, pour le routage côté client', async () => {
      const response = await axios.get(`${config.siteUrl}/route-inexistante-${Date.now()}`, {
        timeout: 15000,
        validateStatus: () => true,
      });

      expect(response.status).toBe(200);
      expect(response.data).toContain('<div id="root">');
    });

    test('sert le bundle applicatif sans y exposer de secret', async () => {
      const page = await axios.get(config.siteUrl, { timeout: 15000 });
      const bundlePath = page.data.match(/\/static\/js\/main\.[a-z0-9]+\.js/)?.[0];

      expect(bundlePath).toBeTruthy();

      const bundle = await axios.get(`${config.siteUrl}${bundlePath}`, { timeout: 30000 });

      // Une clé secrète Stripe ou AWS dans le bundle serait une fuite directe.
      expect(bundle.data).not.toMatch(/sk_live_/);
      expect(bundle.data).not.toMatch(/sk_test_/);
      expect(bundle.data).not.toMatch(/whsec_/);
      expect(bundle.data).not.toMatch(/AKIA[0-9A-Z]{16}/);
    });
  });

  describe('API', () => {
    test('expose l\'état du jeu publiquement', async () => {
      const response = await anon.get('/game/status');

      expect(response.status).toBe(200);
      expect(typeof response.data.isStarted).toBe('boolean');
      expect(response.data).toHaveProperty('startedAt');
    });

    test('répond sous 5 secondes', async () => {
      const started = Date.now();
      await anon.get('/game/status');

      expect(Date.now() - started).toBeLessThan(5000);
    });
  });

  describe('Partage entre origines', () => {
    /**
     * CORS n'est appliqué que par le navigateur : une requête d'API réussit
     * parfaitement alors que le site est inutilisable. C'est arrivé — un
     * déploiement a laissé CORS_ORIGIN sur sa valeur de repli `localhost`, et
     * les 41 tests de santé sont restés au vert pendant que plus personne ne
     * pouvait se connecter.
     */
    test('l\'API autorise l\'origine du site', async () => {
      const response = await axios.get(`${config.apiUrl}/game/status`, {
        headers: { Origin: config.siteUrl },
        timeout: 15000,
        validateStatus: () => true,
      });

      const autorisee = response.headers['access-control-allow-origin'];

      expect(autorisee).toBeDefined();
      expect([config.siteUrl, '*']).toContain(autorisee);
    });

    test('la requête préparatoire du navigateur est acceptée', async () => {
      // Avant un POST, le navigateur émet un OPTIONS : s'il échoue, aucune
      // écriture n'est possible depuis le site.
      const response = await axios.request({
        method: 'OPTIONS',
        url: `${config.apiUrl}/auth/login`,
        headers: {
          Origin: config.siteUrl,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
        timeout: 15000,
        validateStatus: () => true,
      });

      expect(response.status).toBeLessThan(400);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test.failing('[défaut connu] un endpoint authentifié annonce lui aussi l\'origine du site', async () => {
      // Les refus émis par l'authorizer d'API Gateway ne portent pas les
      // en-têtes CORS : ils sont produits avant la lambda, et aucune
      // GatewayResponse n'est déclarée dans serverless.yml.
      //
      // Conséquence pour un participant : à l'expiration de son jeton, au bout
      // d'une heure, le navigateur bloque la réponse 401 au lieu de la
      // transmettre. L'application ne voit pas « session expirée » mais une
      // panne réseau — d'où le « Failed to load user » observé.
      //
      // Défaut antérieur à nos travaux : les deux environnements se comportent
      // de la même façon. Se corrige en déclarant DEFAULT_4XX et DEFAULT_5XX
      // dans les resources.

      const response = await axios.get(`${config.apiUrl}/auth/me`, {
        headers: { Origin: config.siteUrl },
        timeout: 15000,
        validateStatus: () => true,
      });

      // La requête est refusée faute de jeton, mais l'en-tête doit être présent :
      // sans lui, le navigateur masque la réponse et l'application croit à une panne.
      const autorisee = response.headers['access-control-allow-origin'];
      expect([config.siteUrl, '*']).toContain(autorisee);
    });
  });

  describe('Contrôle des accès', () => {
    // Le contrat de sécurité le plus important : aucune donnée de participant
    // ne doit être lisible sans jeton valide.
    const endpointsProteges = [
      '/auth/me',
      '/teams',
      '/enigmas',
      '/parcours',
      '/progress',
      '/content/check-access',
      '/content/enigma',
      '/users/pending-requests',
      '/admin/teams',
      '/admin/users',
      '/admin/stats/overview',
      '/admin/leaderboard',
    ];

    // Les endpoints participants passent par un authorizer qui répond 401,
    // ceux du back-office par un autre qui répond 403. Les deux refusent
    // l'accès : c'est ce que ce test garantit, sans figer lequel des deux codes.
    const refuseLAcces = (response) => {
      expect([401, 403]).toContain(response.status);

      // Aucune donnée métier ne doit transparaître dans une réponse de refus.
      const corps = JSON.stringify(response.data ?? '');
      expect(corps).not.toMatch(/teamId|enigmaId|displayName|"email"/);
    };

    test.each(endpointsProteges)('refuse %s sans jeton', async (endpoint) => {
      refuseLAcces(await anon.get(endpoint));
    });

    test.each(endpointsProteges)('refuse %s avec un jeton invalide', async (endpoint) => {
      refuseLAcces(await anon.get(endpoint, { Authorization: 'Bearer jeton-invalide' }));
    });

    test.each(endpointsProteges)('refuse %s avec un jeton expiré', async (endpoint) => {
      // Jeton JWT syntaxiquement valide, signé avec une clé inconnue, déjà expiré.
      const jetonExpire = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNTE2MjM5MDIyfQ',
        'x9kQZ8vN2mF4pL7wR3tY6uI0oP5aS1dG8hJ2kL4nM6Q',
      ].join('.');

      refuseLAcces(await anon.get(endpoint, { Authorization: `Bearer ${jetonExpire}` }));
    });
  });
});
