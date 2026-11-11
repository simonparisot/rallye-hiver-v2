import { APIGatewayProxyEvent } from 'aws-lambda';

// Les handlers d'administration des intrigues et la lecture côté joueur, sans
// AWS : DynamoDB et le contrôle d'administrateur sont remplacés.
jest.mock('../../../utils/dynamodb', () => ({
  // Jeu lancé : la phase (utils/gamePhase) n'est pas le sujet de ces tests.
  getGameStatus: jest.fn(async () => ({ gameId: 'rallye-2025', isStarted: true })),
  createEnigma: jest.fn(),
  updateEnigma: jest.fn(),
  getEnigmaById: jest.fn(),
  getAllEnigmas: jest.fn(),
}));
jest.mock('../../../utils/adminAuth', () => ({ requireAdmin: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'intrigue-1' }));

import * as db from '../../../utils/dynamodb';
import { handler as creer } from '../create';
import { handler as modifier } from '../update';
import { handler as modifierAdmin } from '../../admin/enigmas/update';
import { handler as lister } from '../list';
import { handler as lire } from '../get';

function evenement(corps: any, enigmaId?: string): APIGatewayProxyEvent {
  return {
    body: corps === undefined ? null : JSON.stringify(corps),
    pathParameters: enigmaId ? { enigmaId } : null,
    requestContext: { authorizer: { userId: 'admin-1' } },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

const BASE = { title: 'La Tour', pdfUrl: 'https://x/a.pdf', correctPassword: 'EIFFEL', enigmaNumber: 1 };

const EXISTANTE = {
  enigmaId: 'e1',
  enigmaNumber: 1,
  title: 'La Tour',
  pdfUrl: 'https://x/a.pdf',
  correctPassword: 'EIFFEL',
  solution: 'secret',
  hints: [{ id: 'h1', order: 1, text: 'indice' }],
  hintsEnabled: false,
  hintsAvailableFrom: null,
  nearMisses: [{ password: 'Tour Eiffel', message: 'Vous chauffez' }],
  isActive: true,
};

beforeEach(() => {
  (db.createEnigma as jest.Mock).mockResolvedValue({});
  (db.getEnigmaById as jest.Mock).mockResolvedValue({ ...EXISTANTE });
  (db.updateEnigma as jest.Mock).mockImplementation(async (_id: string, maj: any) => ({ ...EXISTANTE, ...maj }));
  (db.getAllEnigmas as jest.Mock).mockResolvedValue([{ ...EXISTANTE }]);
});

describe('création (POST /enigmas et POST /admin/enigmas)', () => {
  test('les presques bons sont enregistrés, rognés', async () => {
    const reponse = await creer(
      evenement({ ...BASE, nearMisses: [{ password: ' Tour Eiffel ', message: ' Vous chauffez ' }] })
    );
    expect(reponse.statusCode).toBe(200);
    expect(db.createEnigma).toHaveBeenCalledWith(
      expect.objectContaining({ nearMisses: [{ password: 'Tour Eiffel', message: 'Vous chauffez' }] })
    );
  });

  test('sans le champ : liste vide', async () => {
    await creer(evenement(BASE));
    expect(db.createEnigma).toHaveBeenCalledWith(expect.objectContaining({ nearMisses: [] }));
  });

  test.each([
    ['mot de passe vide', [{ password: '  ', message: 'm' }], /mot de passe vide/],
    ['message vide', [{ password: 'Tour', message: '' }], /message vide/],
    ['pas une liste', 'Tour', /liste/],
    ['ligne non objet', ['Tour'], /invalide/],
    ['mot de passe trop long', [{ password: 'a'.repeat(101), message: 'm' }], /trop long/],
    ['message trop long', [{ password: 'Tour', message: 'm'.repeat(501) }], /trop long/],
    ['pure ponctuation', [{ password: '?!', message: 'm' }], /ni lettre ni chiffre/],
    ['égal au vrai mot de passe une fois normalisé', [{ password: 'eiffel !', message: 'm' }], /mot de passe de l'intrigue/],
    [
      'doublon en forme normalisée',
      [
        { password: 'Tour Eiffel', message: 'un' },
        { password: 'tour-eiffel', message: 'deux' },
      ],
      /doublon/,
    ],
  ])('refus (400) : %s', async (_cas, nearMisses, motif) => {
    const reponse = await creer(evenement({ ...BASE, nearMisses }));
    expect(reponse.statusCode).toBe(400);
    expect(corps(reponse).error).toMatch(motif);
    expect(db.createEnigma).not.toHaveBeenCalled();
  });

  test('limites atteintes sans être dépassées : accepté', async () => {
    const reponse = await creer(
      evenement({ ...BASE, nearMisses: [{ password: 'a'.repeat(100), message: 'm'.repeat(500) }] })
    );
    expect(reponse.statusCode).toBe(200);
  });
});

describe.each([
  ['PUT /enigmas/{id}', modifier],
  ['PUT /admin/enigmas/{id}', modifierAdmin],
])('modification (%s)', (_route, handler) => {
  test('la liste envoyée remplace l\'ancienne', async () => {
    const nouveaux = [
      { password: 'Gustave', message: 'Le prénom ne suffit pas' },
      { password: 'Champ de Mars', message: 'Bon quartier' },
    ];
    const reponse = await handler(evenement({ nearMisses: nouveaux }, 'e1'));
    expect(reponse.statusCode).toBe(200);
    expect(db.updateEnigma).toHaveBeenCalledWith('e1', expect.objectContaining({ nearMisses: nouveaux }));
  });

  test('une liste vide les efface', async () => {
    await handler(evenement({ nearMisses: [] }, 'e1'));
    expect(db.updateEnigma).toHaveBeenCalledWith('e1', expect.objectContaining({ nearMisses: [] }));
  });

  test('une mise à jour partielle sans le champ ne l\'efface pas', async () => {
    const reponse = await handler(evenement({ hintsEnabled: true }, 'e1'));
    expect(reponse.statusCode).toBe(200);
    const maj = (db.updateEnigma as jest.Mock).mock.calls[0][1];
    expect(maj).not.toHaveProperty('nearMisses');
    expect(maj.hintsEnabled).toBe(true);
  });

  test('refus si un presque bon égale le vrai mot de passe existant', async () => {
    const reponse = await handler(evenement({ nearMisses: [{ password: 'Eiffel', message: 'm' }] }, 'e1'));
    expect(reponse.statusCode).toBe(400);
    expect(db.updateEnigma).not.toHaveBeenCalled();
  });

  test('comparé au nouveau mot de passe quand les deux changent', async () => {
    const ok = await handler(
      evenement({ correctPassword: 'GUSTAVE', nearMisses: [{ password: 'Eiffel', message: 'm' }] }, 'e1')
    );
    expect(ok.statusCode).toBe(200);

    const refus = await handler(
      evenement({ correctPassword: 'GUSTAVE', nearMisses: [{ password: 'gustave', message: 'm' }] }, 'e1')
    );
    expect(refus.statusCode).toBe(400);
  });

  test('changer le mot de passe pour un presque bon existant est refusé', async () => {
    const reponse = await handler(evenement({ correctPassword: 'TOUR EIFFEL' }, 'e1'));
    expect(reponse.statusCode).toBe(400);
    expect(corps(reponse).error).toMatch(/Tour Eiffel/);
    expect(db.updateEnigma).not.toHaveBeenCalled();
  });

  test('doublon refusé', async () => {
    const reponse = await handler(
      evenement(
        {
          nearMisses: [
            { password: 'Gustave', message: 'a' },
            { password: 'GUSTAVE', message: 'b' },
          ],
        },
        'e1'
      )
    );
    expect(reponse.statusCode).toBe(400);
  });
});

describe('lecture côté joueur', () => {
  test('GET /enigmas ne divulgue pas les presques bons', async () => {
    const reponse = await lister(evenement(undefined));
    expect(reponse.statusCode).toBe(200);
    const [intrigue] = corps(reponse).enigmas;
    expect(intrigue.enigmaId).toBe('e1');
    expect(intrigue).not.toHaveProperty('nearMisses');
    expect(reponse.body).not.toMatch(/Vous chauffez/);
  });

  test('GET /enigmas/{id} ne divulgue pas les presques bons', async () => {
    const reponse = await lire(evenement(undefined, 'e1'));
    expect(reponse.statusCode).toBe(200);
    expect(corps(reponse).enigma).not.toHaveProperty('nearMisses');
    expect(reponse.body).not.toMatch(/Vous chauffez/);
  });
});
