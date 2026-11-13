import { APIGatewayProxyEvent } from 'aws-lambda';

// DELETE /enigmas/{enigmaId} et DELETE /admin/enigmas/{enigmaId} : même handler.
jest.mock('../../../utils/dynamodb', () => ({
  getEnigmaById: jest.fn(),
  deleteEnigma: jest.fn(),
}));
jest.mock('../../../utils/adminAuth', () => ({
  requireAdmin: jest.fn(),
}));

import * as db from '../../../utils/dynamodb';
import { requireAdmin } from '../../../utils/adminAuth';
import { handler } from '../delete';

const INTRIGUE = { enigmaId: 'e1', enigmaNumber: 3, title: 'La Tour', isActive: true };

function evenement(userId?: string, enigmaId?: string, resource = '/admin/enigmas/{enigmaId}'): APIGatewayProxyEvent {
  return {
    httpMethod: 'DELETE',
    resource,
    pathParameters: enigmaId ? { enigmaId } : null,
    requestContext: { authorizer: userId ? { userId } : undefined },
  } as unknown as APIGatewayProxyEvent;
}

const corps = (reponse: any) => JSON.parse(reponse.body);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (requireAdmin as jest.Mock).mockResolvedValue(undefined);
  (db.getEnigmaById as jest.Mock).mockResolvedValue(INTRIGUE);
  (db.deleteEnigma as jest.Mock).mockResolvedValue(undefined);
});

describe('suppression d\'une intrigue', () => {
  test('401 sans utilisateur authentifié, sans rien lire ni supprimer', async () => {
    const reponse = await handler(evenement(undefined, 'e1'));

    expect(reponse.statusCode).toBe(401);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(db.deleteEnigma).not.toHaveBeenCalled();
  });

  test('403 pour un joueur qui n\'est pas administrateur', async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(new Error('Admin access required'));

    const reponse = await handler(evenement('joueur', 'e1'));

    expect(reponse.statusCode).toBe(403);
    expect(corps(reponse).error).toBe('Admin access required');
    expect(requireAdmin).toHaveBeenCalledWith('joueur');
    expect(db.deleteEnigma).not.toHaveBeenCalled();
  });

  test('404 si l\'intrigue n\'existe pas (ou a déjà été supprimée)', async () => {
    (db.getEnigmaById as jest.Mock).mockResolvedValue(null);

    const reponse = await handler(evenement('admin', 'absente'));

    expect(reponse.statusCode).toBe(404);
    expect(db.getEnigmaById).toHaveBeenCalledWith('absente');
    expect(db.deleteEnigma).not.toHaveBeenCalled();
  });

  test('400 sans identifiant d\'intrigue', async () => {
    const reponse = await handler(evenement('admin'));

    expect(reponse.statusCode).toBe(400);
    expect(db.deleteEnigma).not.toHaveBeenCalled();
  });

  test.each(['/admin/enigmas/{enigmaId}', '/enigmas/{enigmaId}'])(
    '200 pour un administrateur, par la route %s : seule l\'intrigue est supprimée',
    async (resource) => {
      const reponse = await handler(evenement('admin', 'e1', resource));

      expect(reponse.statusCode).toBe(200);
      expect(corps(reponse).message).toBe('Enigma deleted successfully');
      expect(requireAdmin).toHaveBeenCalledWith('admin');
      expect(db.deleteEnigma).toHaveBeenCalledTimes(1);
      expect(db.deleteEnigma).toHaveBeenCalledWith('e1');
    }
  );

  test('500 si DynamoDB échoue pendant la suppression', async () => {
    (db.deleteEnigma as jest.Mock).mockRejectedValue(new Error('DynamoDB indisponible'));

    const reponse = await handler(evenement('admin', 'e1'));

    expect(reponse.statusCode).toBe(500);
    expect(corps(reponse).error).toBe('DynamoDB indisponible');
  });
});
