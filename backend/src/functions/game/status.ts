import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getTeamById, getUserByCognitoSub } from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { getUserIdFromEvent } from '../../utils/auth';
import { lireEtatJeu, phasePourEquipe, themeOfficielDebloque } from '../../utils/gamePhase';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

// Create JWT verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: 'access',
  clientId: COGNITO_CLIENT_ID,
});

/**
 * L'utilisateur derrière le jeton, s'il y en a un et qu'il est valide. La
 * route n'a pas d'authorizer (elle doit répondre aux visiteurs) : le jeton est
 * vérifié ici, et un jeton absent, expiré ou invalide vaut visiteur.
 */
async function utilisateurFacultatif(event: APIGatewayProxyEvent): Promise<string | undefined> {
  const depuisAuthorizer = getUserIdFromEvent(event);
  if (depuisAuthorizer) return depuisAuthorizer;

  const entete = event.headers?.Authorization || event.headers?.authorization;
  if (!entete) return undefined;

  try {
    const payload = await verifier.verify(entete.replace('Bearer ', ''));
    const user = await getUserByCognitoSub(payload.sub as string);
    return user?.userId;
  } catch (jwtErr) {
    console.log('JWT verification failed (continuing as unauthenticated):', jwtErr);
    return undefined;
  }
}

/**
 * GET /game/status — public, jeton facultatif.
 *
 * - `phase` : « avant-lancement » ou « lance », calculée par le serveur
 *   (utils/gamePhase) ; une équipe bêta voit toujours le jeu lancé.
 * - `isStarted` : `phase === 'lance'`, gardé pour les clients qui le lisaient.
 * - `launchAt` : heure du lancement officiel.
 * - `themeOfficiel` : le thème officiel est-il débloqué pour cet utilisateur ?
 *   Oui une fois le jeu lancé ; avant, seulement pour une équipe qui a résolu
 *   une intrigue préliminaire.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = await utilisateurFacultatif(event);
    const etat = await lireEtatJeu();

    let team: any = null;
    if (userId && etat.phase !== 'lance') {
      // Avant le lancement seulement : après, la réponse est la même pour tous.
      try {
        const user = await getUserById(userId);
        team = user?.teamId ? await getTeamById(user.teamId) : null;
      } catch (userCheckErr) {
        // L'équipe est illisible : on répond comme à un visiteur plutôt
        // que de casser une route publique.
        console.warn('Failed to read user team for game status:', userCheckErr);
      }
    }

    const phase = phasePourEquipe(etat.phase, team);

    // Ni startedBy ni le détail de l'item : rien d'autre ne regarde le public.
    return success({
      isStarted: phase === 'lance',
      startedAt: etat.startedAt,
      phase,
      launchAt: etat.launchAt,
      themeOfficiel: themeOfficielDebloque(phase, team),
    });
  } catch (err: any) {
    console.error('Get game status error:', err);
    return error(err.message || 'Failed to get game status', 500);
  }
};
