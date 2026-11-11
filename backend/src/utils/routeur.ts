import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error } from './response';

type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

/**
 * Sert plusieurs routes depuis une seule fonction Lambda.
 *
 * Chaque fonction coûte trois ressources CloudFormation (la fonction, son
 * groupe de journaux et sa permission API Gateway), et la pile est plafonnée
 * à 500. Les routes d'administration d'un même domaine partagent donc une
 * fonction, qui aiguille ici selon la route appelée.
 *
 * La clé est « MÉTHODE /chemin » avec le chemin tel que déclaré dans
 * serverless.yml, paramètres compris : c'est `event.resource`, par exemple
 * « POST /admin/oie/teams/{teamId}/reset ». API Gateway n'appelle la
 * fonction que pour les routes déclarées, le 404 ne sert qu'en cas d'oubli.
 */
export function routeur(routes: Record<string, Handler>): Handler {
  return async (event) => {
    const route = routes[`${event.httpMethod} ${event.resource}`];
    if (!route) {
      return error('Route inconnue', 404);
    }
    return route(event);
  };
}
