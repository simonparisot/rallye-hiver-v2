import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import APIClient from '../helpers/api-client.js';
import { asLeader, createEphemeralUser } from '../helpers/users.js';
import { deleteParticipant, removeFromTestTeam } from '../helpers/cleanup.js';
import { config } from '../config/test-config.js';

/**
 * Entrée d'un nouveau participant dans une équipe.
 * Couvre les scénarios 11, 12 et 10, dans l'ordre où ils se produisent.
 *
 * Le participant est créé pour le scénario puis supprimé — compte Cognito,
 * enregistrement en base et appartenance à l'équipe — quoi qu'il advienne des
 * assertions. L'équipe de test, elle, est conservée.
 */
describe('Arrivée d\'un participant dans une équipe', () => {
  let membreEtabli;
  let nouveau;

  beforeAll(async () => {
    membreEtabli = await asLeader();
  });

  afterAll(async () => {
    // Nettoyage inconditionnel : un échec en cours de route ne doit pas laisser
    // de compte derrière lui, a fortiori en production.
    if (nouveau) {
      await deleteParticipant({ email: nouveau.email, userId: nouveau.userId });
    }
  });

  describe('11. Création d\'un compte participant', () => {
    test('un visiteur peut s\'inscrire et ouvrir une session', async () => {
      nouveau = await createEphemeralUser({ label: 'nouveau', displayName: 'Nouveau participant' });

      const profil = await nouveau.client.get('/auth/me');

      expect(profil.status).toBe(200);
      expect(profil.data.email).toBe(nouveau.email);
      expect(profil.data.displayName).toBe('Nouveau participant');
    });

    test('le compte créé n\'appartient à aucune équipe', async () => {
      const profil = await nouveau.client.get('/auth/me');

      expect(profil.data.teamId).toBeNull();
      expect(profil.data.role).toBeNull();
    });

    test('sans équipe, l\'accès au contenu est refusé', async () => {
      const acces = await nouveau.client.get('/content/check-access');

      expect(acces.status).toBe(200);
      expect(acces.data.hasAccess).toBe(false);
      expect(acces.data.reason).toEqual(expect.any(String));
    });

    test('les identifiants fraîchement créés permettent de se reconnecter', async () => {
      const secondeSession = new APIClient({ label: 'reconnexion' });
      await secondeSession.login(nouveau.email, nouveau.password);

      const profil = await secondeSession.get('/auth/me');
      expect(profil.data.email).toBe(nouveau.email);
    });
  });

  describe('12. Demande d\'adhésion à une équipe', () => {
    test('le participant peut consulter les équipes existantes', async () => {
      const equipes = await nouveau.client.get('/teams');

      expect(equipes.status).toBe(200);
      const liste = equipes.data.teams ?? equipes.data;
      expect(Array.isArray(liste)).toBe(true);
    });

    test('l\'équipe de test n\'apparaît pas dans la liste publique', async () => {
      // Le décor de test ne doit pas être proposé aux participants qui cherchent
      // une équipe à rejoindre : le drapeau isTestTeam la retire de teams/list.ts.
      const equipes = await nouveau.client.get('/teams');
      const liste = equipes.data.teams ?? equipes.data;
      const identifiants = liste.map((e) => e.teamId);

      expect(identifiants).not.toContain(config.teamId);
    });

    test('l\'équipe de test reste accessible par son identifiant', async () => {
      // Contrepartie du masquage : les scénarios doivent continuer de
      // fonctionner. L'équipe disparaît des listes, pas des accès directs.
      const equipe = await nouveau.client.get(`/teams/${config.teamId}`);

      expect(equipe.status).toBe(200);
    });

    test('il demande à rejoindre l\'équipe de test', async () => {
      const demande = await nouveau.client.post(`/teams/${config.teamId}/join`, {});

      expect(demande.status).toBe(200);
    });

    test('une seconde demande identique est refusée', async () => {
      const doublon = await nouveau.client.post(`/teams/${config.teamId}/join`, {});

      expect(doublon.status).toBe(400);
      expect(JSON.stringify(doublon.data)).toMatch(/pending|déjà|already/i);
    });

    test('la demande reste en attente : aucun accès au contenu', async () => {
      const profil = await nouveau.client.get('/auth/me');
      const acces = await nouveau.client.get('/content/check-access');

      expect(profil.data.teamId).toBeNull();
      expect(acces.data.hasAccess).toBe(false);
    });
  });

  describe('10. Acceptation d\'un nouveau membre', () => {
    test('la demande est visible par l\'équipe', async () => {
      const equipe = await membreEtabli.get(`/teams/${config.teamId}`);

      expect(equipe.status).toBe(200);

      const attente = equipe.data.team?.pendingRequests ?? equipe.data.pendingRequests ?? [];
      const identifiants = attente.map((p) => (typeof p === 'string' ? p : p.userId));

      expect(identifiants).toContain(nouveau.userId);
    });

    test('un membre établi accepte la demande', async () => {
      const approbation = await membreEtabli.post(
        `/teams/${config.teamId}/approve/${nouveau.userId}`, {}
      );

      expect(approbation.status).toBe(200);
    });

    test('le participant est désormais rattaché à l\'équipe', async () => {
      const profil = await nouveau.client.get('/auth/me');

      expect(profil.data.teamId).toBe(config.teamId);
      expect(profil.data.role).toBe('member');
    });

    test('il accède au contenu du rallye', async () => {
      const acces = await nouveau.client.get('/content/check-access');

      expect(acces.data.hasAccess).toBe(true);
    });

    test('il voit la progression de son équipe', async () => {
      const progression = await nouveau.client.get('/progress');

      expect(progression.status).toBe(200);
      expect(progression.data.teamId).toBe(config.teamId);
    });

    test('la demande a quitté la file d\'attente', async () => {
      const equipe = await membreEtabli.get(`/teams/${config.teamId}`);
      const attente = equipe.data.team?.pendingRequests ?? equipe.data.pendingRequests ?? [];
      const identifiants = attente.map((p) => (typeof p === 'string' ? p : p.userId));

      expect(identifiants).not.toContain(nouveau.userId);
    });

    test('le membre peut ensuite être retiré de l\'équipe', async () => {
      const retrait = await membreEtabli.delete(
        `/teams/${config.teamId}/members/${nouveau.userId}`
      );

      expect(retrait.status).toBe(200);

      const profil = await nouveau.client.get('/auth/me');
      expect(profil.data.teamId).toBeNull();
    });
  });
});
