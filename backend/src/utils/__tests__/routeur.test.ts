// uuid est publié en ESM, que ts-jest ne charge pas ; il n'est pas appelé ici.
jest.mock('uuid', () => ({ v4: () => 'uuid-test' }));

import { APIGatewayProxyEvent } from 'aws-lambda';
import { routeur } from '../routeur';
import { handler as adminGame } from '../../functions/admin/game/routes';
import { handler as adminOie } from '../../functions/oie/admin/routes';

const evenement = (httpMethod: string, resource: string) =>
  ({ httpMethod, resource, requestContext: {} } as unknown as APIGatewayProxyEvent);

describe('routeur', () => {
  const a = jest.fn(async () => ({ statusCode: 200, body: 'a' }));
  const b = jest.fn(async () => ({ statusCode: 200, body: 'b' }));
  const h = routeur({
    'POST /admin/game/start': a,
    'POST /admin/teams/{teamId}/hints/reset': b,
  });

  it('aiguille selon la méthode et le chemin déclaré', async () => {
    expect((await h(evenement('POST', '/admin/game/start'))).body).toBe('a');
    expect((await h(evenement('POST', '/admin/teams/{teamId}/hints/reset'))).body).toBe('b');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('répond 404 pour une route non déclarée, sans appeler de handler', async () => {
    const r = await h(evenement('GET', '/admin/game/start'));
    expect(r.statusCode).toBe(404);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('les routeurs réels exigent toujours un administrateur', async () => {
    // Sans utilisateur authentifié, chaque handler répond 401 avant toute
    // lecture en base : preuve que la route atteint bien le bon handler.
    for (const [h2, m, p] of [
      [adminGame, 'GET', '/admin/game/status'],
      [adminGame, 'POST', '/admin/game/reset'],
      [adminOie, 'POST', '/admin/oie/teams/{teamId}/reset'],
    ] as const) {
      const r = await h2(evenement(m, p));
      expect(r.statusCode).toBe(401);
    }
  });
});
