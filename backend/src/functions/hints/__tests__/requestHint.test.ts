import { APIGatewayProxyEvent } from 'aws-lambda';
import { ModelCaller } from '../../../services/hintSelector';

// La couche DynamoDB est entièrement remplacée : ces tests ne parlent à aucun
// service, ils vérifient les refus, les deux modes et le chemin nominal.
jest.mock('../../../utils/dynamodb', () => ({
  getUserById: jest.fn(),
  getTeamById: jest.fn(),
  getEnigmaById: jest.fn(),
  getTeamProgress: jest.fn(),
  createOrUpdateTeamProgress: jest.fn(),
  createHintRequest: jest.fn(),
  getHintRequestsByTeamAndEnigma: jest.fn(),
}));

import * as db from '../../../utils/dynamodb';
import { handler } from '../requestHint';

const INDICES = [
  { id: 'h1', order: 1, text: 'Premier indice.' },
  { id: 'h2', order: 2, text: 'Deuxième indice.' },
];

const AVANCEMENT = 'Nous avons testé les horloges sans succès et nous bloquons complètement.';

function evenement(corps: any, enigmaId = 'e1'): APIGatewayProxyEvent {
  return {
    pathParameters: { enigmaId },
    body: JSON.stringify(corps),
    requestContext: { authorizer: { userId: 'u1' } },
  } as unknown as APIGatewayProxyEvent;
}

const caller: ModelCaller = async () => ({
  hintId: 'h1',
  justification: "l'équipe débute",
  model: 'faux-modele',
  inputTokens: 100,
  outputTokens: 20,
});

function decorNominal() {
  (db.getUserById as jest.Mock).mockResolvedValue({ userId: 'u1', teamId: 't1' });
  (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: true });
  (db.getEnigmaById as jest.Mock).mockResolvedValue({
    enigmaId: 'e1',
    title: 'Enigme',
    isActive: true,
    points: 20,
    correctPassword: 'MOT',
    solution: 'La démarche complète.',
    hints: INDICES,
  });
  (db.getTeamProgress as jest.Mock).mockResolvedValue(undefined);
  (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([]);
  (db.createHintRequest as jest.Mock).mockResolvedValue({});
  (db.createOrUpdateTeamProgress as jest.Mock).mockResolvedValue({});
}

const ancienProvider = process.env.HINT_PROVIDER;

describe('POST /hints/{enigmaId}/request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    decorNominal();
    delete process.env.HINT_PROVIDER; // défaut : appel direct
  });

  afterAll(() => {
    if (ancienProvider === undefined) delete process.env.HINT_PROVIDER;
    else process.env.HINT_PROVIDER = ancienProvider;
  });

  describe('mode anthropic : réponse synchrone', () => {
    it("livre l'indice choisi et archive la demande comme aboutie", async () => {
      const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k1' }), caller);
      expect(reponse.statusCode).toBe(200);

      const corps = JSON.parse(reponse.body);
      expect(corps.status).toBe('done');
      expect(corps.hint).toEqual({ id: 'h1', text: 'Premier indice.' });
      expect(corps.hintsRequested).toBe(1);
      expect(corps.remainingHints).toBe(1);

      const archive = (db.createHintRequest as jest.Mock).mock.calls[0][0];
      expect(archive.status).toBe('done');
      expect(archive.progressText).toBe(AVANCEMENT);
      expect(archive.hintId).toBe('h1');
      expect(archive.hintText).toBe('Premier indice.');
      expect(archive.teamEnigmaKey).toBe('t1#e1');
      expect(archive.model).toBe('faux-modele');
      // Pas de points pendant l'essai.
      expect(archive.pointsCharged).toBe(0);

      const maj = (db.createOrUpdateTeamProgress as jest.Mock).mock.calls[0];
      expect(maj[0]).toBe('t1');
      expect(maj[2].hintsRequested).toBe(1);
      expect(maj[2].lastHintAt).toBeDefined();
    });

    it("ne facture rien au deuxième indice non plus", async () => {
      (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([
        { status: 'done', hintId: 'h1', requestedAt: '2026-01-01T10:00:00.000Z' },
      ]);
      const callerH2: ModelCaller = async () => ({ hintId: 'h2', justification: '', model: 'faux' });

      const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k2' }), callerH2);
      const corps = JSON.parse(reponse.body);

      expect(reponse.statusCode).toBe(200);
      expect(corps.hint.id).toBe('h2');
      expect(corps.pointsCharged).toBe(0);
      expect(corps.hintsRequested).toBe(2);
      expect(corps.remainingHints).toBe(0);
    });

    it("n'archive rien quand le modèle échoue", async () => {
      const callerEnPanne: ModelCaller = async () => {
        throw new Error('502 Bad Gateway');
      };
      const reponse = await handler(
        evenement({ progress: AVANCEMENT, requestKey: 'k9' }),
        callerEnPanne
      );
      expect(reponse.statusCode).toBe(502);
      expect(db.createHintRequest).not.toHaveBeenCalled();
      expect(db.createOrUpdateTeamProgress).not.toHaveBeenCalled();
    });

    it("n'archive rien si le modèle désigne un indice inconnu", async () => {
      const callerFantaisiste: ModelCaller = async () => ({
        hintId: 'indice-invente',
        justification: '',
        model: 'faux',
      });
      const reponse = await handler(
        evenement({ progress: AVANCEMENT, requestKey: 'k10' }),
        callerFantaisiste
      );
      expect(reponse.statusCode).toBe(502);
      expect(db.createHintRequest).not.toHaveBeenCalled();
    });
  });

  describe('mode queue : accusé de réception', () => {
    beforeEach(() => {
      process.env.HINT_PROVIDER = 'queue';
    });

    it("enregistre la demande en attente et répond 202, sans appeler le modèle", async () => {
      const appels: number[] = [];
      const callerEspion: ModelCaller = async () => {
        appels.push(1);
        return { hintId: 'h1', justification: '', model: 'faux' };
      };

      const reponse = await handler(
        evenement({ progress: AVANCEMENT, requestKey: 'q1' }),
        callerEspion
      );

      expect(reponse.statusCode).toBe(202);
      const corps = JSON.parse(reponse.body);
      expect(corps.status).toBe('pending');
      expect(typeof corps.requestId).toBe('string');
      expect(corps.hint).toBeUndefined(); // rien à livrer encore

      // Le modèle n'est jamais sollicité depuis la lambda dans ce mode.
      expect(appels).toHaveLength(0);

      const archive = (db.createHintRequest as jest.Mock).mock.calls[0][0];
      expect(archive.status).toBe('pending');
      expect(archive.progressText).toBe(AVANCEMENT);
      expect(archive.hintId).toBeUndefined();
      expect(archive.pointsCharged).toBe(0);
      expect(archive.excludedHintIds).toEqual([]);
    });

    it("transmet au worker les indices déjà donnés, pour qu'il ne les redonne pas", async () => {
      (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([
        { status: 'done', hintId: 'h1' },
      ]);

      await handler(evenement({ progress: AVANCEMENT, requestKey: 'q2' }), caller);

      const archive = (db.createHintRequest as jest.Mock).mock.calls[0][0];
      expect(archive.excludedHintIds).toEqual(['h1']);
    });

    it('refuse une seconde demande tant que la première est en attente', async () => {
      (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([
        { status: 'pending', requestId: 'r1' },
      ]);

      const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'q3' }), caller);

      expect(reponse.statusCode).toBe(409);
      expect(JSON.parse(reponse.body).error).toMatch(/déjà en cours/);
      expect(db.createHintRequest).not.toHaveBeenCalled();
    });

    it("laisse redemander après un échec : une demande échouée n'a consommé aucun indice", async () => {
      (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([
        { status: 'failed', failureReason: 'le modèle a renvoyé n\'importe quoi' },
      ]);

      const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'q4' }), caller);

      expect(reponse.statusCode).toBe(202);
      const archive = (db.createHintRequest as jest.Mock).mock.calls[0][0];
      expect(archive.excludedHintIds).toEqual([]);
    });
  });

  describe('refus communs aux deux modes', () => {
    it("refuse un texte d'avancement trop court", async () => {
      const reponse = await handler(evenement({ progress: 'bloqué', requestKey: 'k3' }), caller);
      expect(reponse.statusCode).toBe(400);
      expect(db.createHintRequest).not.toHaveBeenCalled();
    });

    it("refuse un texte d'avancement au-delà de 3 000 caractères", async () => {
      const reponse = await handler(
        evenement({ progress: 'a'.repeat(3001), requestKey: 'k4' }),
        caller
      );
      expect(reponse.statusCode).toBe(400);
      expect(db.createHintRequest).not.toHaveBeenCalled();
    });

    it("refuse si l'équipe a déjà résolu l'énigme", async () => {
      (db.getTeamProgress as jest.Mock).mockResolvedValue({ solved: true });
      const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k5' }), caller);
      expect(reponse.statusCode).toBe(409);
      expect(db.createHintRequest).not.toHaveBeenCalled();
    });

    it("refuse si l'énigme n'a aucun indice", async () => {
      (db.getEnigmaById as jest.Mock).mockResolvedValue({
        enigmaId: 'e1',
        title: 'Enigme',
        isActive: true,
        points: 20,
        correctPassword: 'MOT',
        hints: [],
      });
      const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k6' }), caller);
      expect(reponse.statusCode).toBe(404);
    });

    it('renvoie un 409 explicite quand tous les indices ont déjà été donnés', async () => {
      (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([
        { status: 'done', hintId: 'h1' },
        { status: 'done', hintId: 'h2' },
      ]);
      const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k7' }), caller);
      expect(reponse.statusCode).toBe(409);
      expect(JSON.parse(reponse.body).error).toContain('tous les indices');
      expect(db.createHintRequest).not.toHaveBeenCalled();
    });

    it("refuse une équipe qui n'a pas réglé son inscription", async () => {
      (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: false });
      const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k8' }), caller);
      expect(reponse.statusCode).toBe(403);
    });

    it('refuse une seconde demande simultanée portant la même clé', async () => {
      // Le modèle est artificiellement lent : la seconde demande arrive pendant
      // que la première est encore en vol, comme sur un double clic.
      let libere: () => void = () => {};
      const attente = new Promise<void>((resolve) => {
        libere = resolve;
      });
      const callerLent: ModelCaller = async () => {
        await attente;
        return { hintId: 'h1', justification: '', model: 'faux' };
      };

      const premiere = handler(
        evenement({ progress: AVANCEMENT, requestKey: 'double' }),
        callerLent
      );
      const seconde = await handler(
        evenement({ progress: AVANCEMENT, requestKey: 'double' }),
        callerLent
      );

      expect(seconde.statusCode).toBe(409);

      libere();
      const resultat = await premiere;
      expect(resultat.statusCode).toBe(200);
      // Une seule demande archivée.
      expect(db.createHintRequest).toHaveBeenCalledTimes(1);
    });
  });
});
