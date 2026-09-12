import { describe, test, expect, beforeAll } from '@jest/globals';
import APIClient from '../helpers/api-client.js';
import { asLeader, asAdmin } from '../helpers/users.js';
import { enigmaWithHints } from '../helpers/enigmas.js';

/**
 * Contrat de l'API des indices.
 *
 * Ces tests ne cherchent pas à provoquer un appel réussi au modèle : une
 * demande aboutie coûte de l'argent, met quelques secondes et retire des points
 * à l'équipe de test. Ils vérifient ce qui ne dépend pas du modèle — le
 * contrôle d'accès, la validation de la saisie, le refus sur une énigme sans
 * indice, et l'absence de fuite de la solution — puis lisent les indices déjà
 * obtenus, qui ne déclenchent aucun appel.
 *
 * Le parcours complet, indice livré compris, est exercé en test unitaire avec
 * un faux client (`backend/src/functions/hints/__tests__/requestHint.test.ts`).
 */
describe("Indices", () => {
  let anon;
  let participant;

  beforeAll(async () => {
    anon = new APIClient({ label: 'anonyme' });
    participant = await asLeader();
  });

  describe('Contrôle d\'accès', () => {
    test('GET /hints/{id} exige une authentification', async () => {
      const reponse = await anon.get('/hints/enigme-inexistante');

      expect([401, 403]).toContain(reponse.status);
    });

    test('POST /hints/{id}/request exige une authentification', async () => {
      const reponse = await anon.post('/hints/enigme-inexistante/request', {
        progress: 'Nous avons essayé plusieurs pistes sans succès pour le moment.',
      });

      expect([401, 403]).toContain(reponse.status);
    });

    test('le journal des demandes est refusé à un participant', async () => {
      const reponse = await participant.get('/admin/hints/requests');

      expect([401, 403]).toContain(reponse.status);
    });
  });

  describe('Validation du texte d\'avancement', () => {
    let enigmaId;

    beforeAll(async () => {
      const enigme = await enigmaWithHints();
      enigmaId = enigme?.enigmaId;
    });

    test('refuse une description absente', async () => {
      if (!enigmaId) return; // aucune énigme avec indices dans cet environnement

      const reponse = await participant.post(`/hints/${enigmaId}/request`, {});

      expect(reponse.status).toBe(400);
    });

    test('refuse une description de moins de 20 caractères', async () => {
      if (!enigmaId) return;

      const reponse = await participant.post(`/hints/${enigmaId}/request`, {
        progress: 'on bloque',
      });

      expect(reponse.status).toBe(400);
    });

    test('refuse une description de plus de 3 000 caractères', async () => {
      if (!enigmaId) return;

      const reponse = await participant.post(`/hints/${enigmaId}/request`, {
        progress: 'a'.repeat(3001),
      });

      expect(reponse.status).toBe(400);
    });
  });

  describe('Lecture des indices déjà obtenus', () => {
    test('renvoie la liste, le coût du prochain et rien de plus', async () => {
      const enigme = await enigmaWithHints();
      if (!enigme) return;

      const reponse = await participant.get(`/hints/${enigme.enigmaId}`);

      expect(reponse.status).toBe(200);
      expect(Array.isArray(reponse.data.hints)).toBe(true);
      expect(typeof reponse.data.nextHintCost).toBe('number');
      expect(typeof reponse.data.remainingHints).toBe('number');

      // Seuls les indices payés sont renvoyés : jamais la liste complète.
      expect(reponse.data.hints.length).toBe(reponse.data.hintsRequested);
    });

    test('refuse une énigme inexistante', async () => {
      const reponse = await participant.get('/hints/enigme-qui-nexiste-pas');

      expect(reponse.status).toBe(404);
    });
  });

  describe('Confidentialité', () => {
    test('la liste des énigmes ne contient ni solution ni texte d\'indice', async () => {
      const reponse = await participant.get('/enigmas');

      expect(reponse.status).toBe(200);

      for (const enigme of reponse.data.enigmas) {
        expect(enigme.correctPassword).toBeUndefined();
        expect(enigme.solution).toBeUndefined();
        expect(enigme.hints).toBeUndefined();
        // Le joueur sait seulement combien d'indices existent.
        expect(['number', 'undefined']).toContain(typeof enigme.hintsCount);
      }
    });

    test('le détail d\'une énigme ne contient ni solution ni texte d\'indice', async () => {
      const liste = await participant.get('/enigmas');
      const premiere = liste.data.enigmas?.[0];
      if (!premiere) return;

      const reponse = await participant.get(`/enigmas/${premiere.enigmaId}`);

      expect(reponse.status).toBe(200);
      expect(reponse.data.enigma.correctPassword).toBeUndefined();
      expect(reponse.data.enigma.solution).toBeUndefined();
      expect(reponse.data.enigma.hints).toBeUndefined();
    });
  });

  describe('Journal des demandes, côté administrateur', () => {
    let admin;

    beforeAll(async () => {
      admin = await asAdmin();
    });

    test('répond avec une liste, un total et des statistiques', async () => {
      const reponse = await admin.get('/admin/hints/requests');

      expect(reponse.status).toBe(200);
      expect(Array.isArray(reponse.data.requests)).toBe(true);
      expect(typeof reponse.data.total).toBe('number');
      expect(reponse.data.stats).toMatchObject({
        totalRequests: expect.any(Number),
        uniqueTeams: expect.any(Number),
        uniqueEnigmas: expect.any(Number),
        totalPointsCharged: expect.any(Number),
      });
    });

    test('accepte un filtre par énigme sans erreur', async () => {
      const enigme = await enigmaWithHints();
      if (!enigme) return;

      const reponse = await admin.get(`/admin/hints/requests?enigmaId=${enigme.enigmaId}`);

      expect(reponse.status).toBe(200);
      for (const demande of reponse.data.requests) {
        expect(demande.enigmaId).toBe(enigme.enigmaId);
      }
    });

    test('respecte la limite demandée', async () => {
      const reponse = await admin.get('/admin/hints/requests?limit=5');

      expect(reponse.status).toBe(200);
      expect(reponse.data.requests.length).toBeLessThanOrEqual(5);
      expect(reponse.data.limit).toBe(5);
    });
  });
});
