import { APIGatewayProxyEvent } from 'aws-lambda';
import { ModelCaller } from '../../../services/hintSelector';

// La couche DynamoDB est entierement remplacee : ces tests ne parlent a aucun
// service, ils verifient les refus et le chemin nominal du handler.
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
  { id: 'h2', order: 2, text: 'Deuxieme indice.' },
];

const AVANCEMENT = 'Nous avons teste les horloges sans succes et nous bloquons completement.';

function evenement(corps: any, enigmaId = 'e1'): APIGatewayProxyEvent {
  return {
    pathParameters: { enigmaId },
    body: JSON.stringify(corps),
    requestContext: { authorizer: { userId: 'u1' } },
  } as unknown as APIGatewayProxyEvent;
}

const caller: ModelCaller = async () => ({
  hintId: 'h1',
  justification: 'l\'equipe debute',
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
    solution: 'La demarche complete.',
    hints: INDICES,
  });
  (db.getTeamProgress as jest.Mock).mockResolvedValue(undefined);
  (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([]);
  (db.createHintRequest as jest.Mock).mockResolvedValue({});
  (db.createOrUpdateTeamProgress as jest.Mock).mockResolvedValue({});
}

describe('POST /hints/{enigmaId}/request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    decorNominal();
  });

  it('livre l\'indice choisi et facture le cout annonce', async () => {
    const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k1' }), caller);
    expect(reponse.statusCode).toBe(200);

    const corps = JSON.parse(reponse.body);
    expect(corps.hint).toEqual({ id: 'h1', text: 'Premier indice.' });
    expect(corps.pointsCharged).toBe(5); // 25 % de 20
    expect(corps.hintsRequested).toBe(1);
    expect(corps.remainingHints).toBe(1);

    // La demande est archivee avec le texte de l'equipe et le cout.
    const archive = (db.createHintRequest as jest.Mock).mock.calls[0][0];
    expect(archive.progressText).toBe(AVANCEMENT);
    expect(archive.hintId).toBe('h1');
    expect(archive.hintText).toBe('Premier indice.');
    expect(archive.pointsCharged).toBe(5);
    expect(archive.teamEnigmaKey).toBe('t1#e1');
    expect(archive.model).toBe('faux-modele');

    // La progression de l'equipe suit.
    const maj = (db.createOrUpdateTeamProgress as jest.Mock).mock.calls[0];
    expect(maj[0]).toBe('t1');
    expect(maj[2].hintsRequested).toBe(1);
    expect(maj[2].lastHintAt).toBeDefined();
  });

  it('facture le deuxieme indice au meme tarif, cumulativement', async () => {
    (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([
      { hintId: 'h1', requestedAt: '2026-01-01T10:00:00.000Z' },
    ]);
    const callerH2: ModelCaller = async () => ({ hintId: 'h2', justification: '', model: 'faux' });

    const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k2' }), callerH2);
    const corps = JSON.parse(reponse.body);

    expect(reponse.statusCode).toBe(200);
    expect(corps.hint.id).toBe('h2');
    expect(corps.pointsCharged).toBe(5);
    expect(corps.hintsRequested).toBe(2);
    expect(corps.remainingHints).toBe(0);
  });

  it('refuse un texte d\'avancement trop court', async () => {
    const reponse = await handler(evenement({ progress: 'bloque', requestKey: 'k3' }), caller);
    expect(reponse.statusCode).toBe(400);
    expect(db.createHintRequest).not.toHaveBeenCalled();
  });

  it('refuse un texte d\'avancement au-dela de 3 000 caracteres', async () => {
    const reponse = await handler(
      evenement({ progress: 'a'.repeat(3001), requestKey: 'k4' }),
      caller
    );
    expect(reponse.statusCode).toBe(400);
    expect(db.createHintRequest).not.toHaveBeenCalled();
  });

  it('refuse si l\'equipe a deja resolu l\'enigme', async () => {
    (db.getTeamProgress as jest.Mock).mockResolvedValue({ solved: true });
    const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k5' }), caller);
    expect(reponse.statusCode).toBe(409);
    expect(db.createHintRequest).not.toHaveBeenCalled();
  });

  it('refuse si l\'enigme n\'a aucun indice', async () => {
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

  it('renvoie un 409 explicite quand tous les indices ont deja ete donnes', async () => {
    (db.getHintRequestsByTeamAndEnigma as jest.Mock).mockResolvedValue([
      { hintId: 'h1' },
      { hintId: 'h2' },
    ]);
    const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k7' }), caller);
    expect(reponse.statusCode).toBe(409);
    expect(JSON.parse(reponse.body).error).toContain('tous les indices');
    expect(db.createHintRequest).not.toHaveBeenCalled();
  });

  it('refuse une equipe qui n\'a pas regle son inscription', async () => {
    (db.getTeamById as jest.Mock).mockResolvedValue({ teamId: 't1', hasPaid: false });
    const reponse = await handler(evenement({ progress: AVANCEMENT, requestKey: 'k8' }), caller);
    expect(reponse.statusCode).toBe(403);
  });

  it('ne facture rien et n\'archive rien quand le modele echoue', async () => {
    const callerEnPanne: ModelCaller = async () => {
      throw new Error('502 Bad Gateway');
    };
    const reponse = await handler(
      evenement({ progress: AVANCEMENT, requestKey: 'k9' }),
      callerEnPanne
    );
    expect(reponse.statusCode).toBe(502);
    expect(JSON.parse(reponse.body).error).toContain('Aucun point');
    expect(db.createHintRequest).not.toHaveBeenCalled();
    expect(db.createOrUpdateTeamProgress).not.toHaveBeenCalled();
  });

  it('ne facture rien si le modele designe un indice inconnu', async () => {
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

  it('refuse une seconde demande simultanee portant la meme cle', async () => {
    // Le modele est artificiellement lent : la seconde demande arrive pendant
    // que la premiere est encore en vol, comme sur un double clic.
    let libere: () => void = () => {};
    const attente = new Promise<void>((resolve) => {
      libere = resolve;
    });
    const callerLent: ModelCaller = async () => {
      await attente;
      return { hintId: 'h1', justification: '', model: 'faux' };
    };

    const premiere = handler(evenement({ progress: AVANCEMENT, requestKey: 'double' }), callerLent);
    const seconde = await handler(
      evenement({ progress: AVANCEMENT, requestKey: 'double' }),
      callerLent
    );

    expect(seconde.statusCode).toBe(409);

    libere();
    const resultat = await premiere;
    expect(resultat.statusCode).toBe(200);
    // Une seule demande archivee, donc une seule facturation.
    expect(db.createHintRequest).toHaveBeenCalledTimes(1);
  });
});
