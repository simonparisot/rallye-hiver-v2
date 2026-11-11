import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  getUserById,
  getParcoursById,
  getTeamParcoursAccess,
  markTeamParcoursCompleted,
  logParcoursAttempt,
  updateTeam,
} from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { ParcoursAttemptLog } from '../../types';
import { loadAccessContext, evaluateParcoursAccess } from '../../utils/parcoursAccess';
import { normalizePassword, hasUsablePassword } from '../../utils/password';

/**
 * POST /parcours/{parcoursId}/attempt — { password }
 *
 * L'équipe valide une tournée en saisissant le mot de passe trouvé à sa fin.
 * Remplace l'ancien « Marquer comme réalisée », que rien ne vérifiait.
 *
 * Mêmes règles que pour une intrigue : comparaison sans casse, accents,
 * ligatures, espaces ni ponctuation ; tentatives illimitées ; une mauvaise
 * réponse est un 200 avec `success: false`. Chaque tentative est journalisée
 * dans la table des tentatives de tournées, à part de celle des intrigues.
 *
 * Les tournées ne rapportent aucun point : la réalisation n'est qu'un état de
 * l'équipe (TeamParcoursAccess.completed), compté dans ses statistiques.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;
    const parcoursId = event.pathParameters?.parcoursId;

    if (!userId) {
      return error('Unauthorized', 401);
    }

    if (!parcoursId) {
      return error('Missing parcoursId', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const password = body.password;
    if (typeof password !== 'string' || !password.trim()) {
      return error('Missing required field: password', 400);
    }

    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('User must be in a team', 403);
    }
    const teamId: string = user.teamId;

    const parcours = await getParcoursById(parcoursId);
    if (!parcours) {
      return error('Parcours not found', 404);
    }

    // Une tournée non publiée ou encore verrouillée ne peut pas avoir été
    // parcourue : rien ne dit ici si son mot de passe existe.
    if (!parcours.isActive) {
      return error('Parcours locked', 403);
    }
    const { isUnlocked } = evaluateParcoursAccess(parcours, await loadAccessContext(teamId));
    if (!isUnlocked) {
      return error('Parcours locked', 403);
    }

    if (!hasUsablePassword(parcours.correctPassword)) {
      return error(
        "Le mot de passe de cette tournée n'est pas encore disponible : elle ne peut pas encore être validée.",
        409
      );
    }

    const now = new Date().toISOString();
    const isCorrect = normalizePassword(password) === normalizePassword(parcours.correctPassword);

    const attemptLog: ParcoursAttemptLog = {
      attemptId: uuidv4(),
      teamId,
      parcoursId,
      password,
      success: isCorrect,
      attemptedAt: now,
      attemptedBy: userId,
      ipAddress: event.requestContext.identity?.sourceIp,
    };
    await logParcoursAttempt(attemptLog);

    // Comme pour les intrigues : toute tentative compte comme activité.
    await updateTeam(teamId, { lastActivityAt: now });

    if (!isCorrect) {
      return success({
        success: false,
        message: "Ce n'est pas le mot de passe de cette tournée. Vérifiez-le et réessayez.",
      });
    }

    const existing = await getTeamParcoursAccess(teamId, parcoursId);
    const alreadyCompleted = !!existing?.completed;

    if (!alreadyCompleted) {
      await markTeamParcoursCompleted(teamId, parcoursId, now);
    }

    return success({
      success: true,
      message: alreadyCompleted
        ? "C'est le bon mot de passe ! (Cette tournée était déjà validée par votre équipe)"
        : 'Bravo ! Tournée validée.',
      alreadyCompleted,
    });
  } catch (err: any) {
    console.error('Error submitting parcours password:', err);
    return error(err.message || 'Failed to submit parcours password');
  }
};
