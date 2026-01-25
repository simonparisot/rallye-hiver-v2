import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  getEnigmaById,
  getUserById,
  getTeamById,
  getTeamProgress,
  createOrUpdateTeamProgress,
  logPasswordAttempt,
  updateTeam,
  getAllParcours,
  getAllTeamProgress,
  grantParcoursAccess,
  getTeamParcoursAccess,
} from '../../utils/dynamodb';
import { success, error } from '../../utils/response';
import { PasswordAttemptLog } from '../../types';

/**
 * Normalize a password for comparison
 * - Converts to lowercase
 * - Removes all whitespace (spaces, tabs, newlines)
 * - Removes accents/diacritics (é→e, à→a, ç→c, etc.)
 * - Normalizes ligatures (œ→oe, æ→ae)
 * - Removes all punctuation and special characters
 * - Keeps only: a-z and 0-9
 */
function normalizePassword(input: string): string {
  return input
    .toLowerCase()                     // 1. Convert to lowercase
    .normalize('NFD')                  // 2. Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')  // 3. Remove diacritics (accents)
    .replace(/œ/g, 'oe')              // 4. Normalize ligature œ
    .replace(/æ/g, 'ae')              // 5. Normalize ligature æ
    .replace(/\s+/g, '')              // 6. Remove all whitespace
    .replace(/[^a-z0-9]/g, '');       // 7. Keep only a-z and 0-9 (removes hyphens, punctuation, etc.)
}

// Collection of funny error messages for incorrect password attempts
const FUNNY_ERROR_MESSAGES = [
  "Oups ! Ce n'est pas le bon code. Essayez encore !",
  "Presque ! Enfin... non, pas du tout en fait.",
  "Raté ! Mais ne vous découragez pas !",
  "Hmm... Non. Retournez voir l'énigme !",
  "Ce code ne correspond à rien... pour l'instant !",
  "Essayez encore ! Vous êtes sur la bonne voie... peut-être.",
  "Pas encore ! Mais chaque tentative vous rapproche du but.",
  "Non, non, non ! Mais l'échec est le début du succès !",
  "Raté ! La réponse est ailleurs, cherchez encore.",
  "Ce n'est pas ça ! Mais bravo d'avoir essayé.",
  "Incorrect ! Peut-être qu'une petite pause café vous aidera ?",
  "Perdu ! Mais Rome ne s'est pas faite en un jour.",
  "Nope ! Retour à l'énigme, détective !",
  "Faux ! Mais vous chauffez... ou pas.",
  "Non ! Allez, courage, vous allez y arriver !",
  "Raté ! Einstein aussi s'est trompé parfois.",
  "Ce n'est pas la bonne réponse... Réessayez !",
  "Incorrect ! Les grands esprits se trompent aussi.",
  "Oups ! Pas tout à fait. Nouvelle tentative ?",
  "Non ! Mais l'erreur est humaine... et instructive !",
];

/**
 * Get a random funny error message for incorrect password attempts
 */
const getRandomErrorMessage = (): string => {
  const randomIndex = Math.floor(Math.random() * FUNNY_ERROR_MESSAGES.length);
  return FUNNY_ERROR_MESSAGES[randomIndex];
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Unauthorized', 401);
    }

    const { enigmaId, password } = body;

    if (!enigmaId || !password) {
      return error('Missing required fields: enigmaId, password', 400);
    }

    // Get user and verify team membership
    const user = await getUserById(userId);
    if (!user || !user.teamId) {
      return error('User must be in a team to attempt enigmas', 403);
    }

    const team = await getTeamById(user.teamId);
    if (!team) {
      return error('Team not found', 404);
    }

    // Check if team has paid
    if (!team.hasPaid) {
      return error('Team must complete payment to attempt enigmas', 403);
    }

    // Get enigma
    const enigma = await getEnigmaById(enigmaId);
    if (!enigma) {
      return error('Enigma not found', 404);
    }

    if (!enigma.isActive) {
      return error('This enigma is not currently active', 403);
    }

    const now = new Date().toISOString();

    // Normalize passwords for comparison (removes spaces, accents, punctuation, case-insensitive)
    const normalizedInput = normalizePassword(password);
    const normalizedCorrect = normalizePassword(enigma.correctPassword);
    const isCorrect = normalizedInput === normalizedCorrect;

    // Check if enigma is already solved by this team
    const existingProgress = await getTeamProgress(user.teamId, enigmaId);
    const alreadySolved = existingProgress && existingProgress.solved;

    // Log the password attempt
    const attemptLog: PasswordAttemptLog = {
      attemptId: uuidv4(),
      teamId: user.teamId,
      enigmaId,
      teamEnigmaKey: `${user.teamId}#${enigmaId}`,
      password,
      success: isCorrect,
      attemptedAt: now,
      attemptedBy: userId,
      ipAddress: event.requestContext.identity?.sourceIp,
    };

    await logPasswordAttempt(attemptLog);

    // Update team lastActivityAt on every password attempt (correct or incorrect)
    await updateTeam(user.teamId, { lastActivityAt: now });

    // Only update progress if not already solved (or if correct answer to mark as solved)
    if (!alreadySolved) {
      // Update team progress
      const progressUpdates: any = {
        lastAttemptAt: now,
        attemptCount: (existingProgress?.attemptCount || 0) + 1,
        updatedAt: now,
      };

      if (!existingProgress) {
        progressUpdates.firstAttemptAt = now;
        progressUpdates.solved = false;
        progressUpdates.createdAt = now;
      }

      if (isCorrect) {
        progressUpdates.solved = true;
        progressUpdates.solvedAt = now;
      }

      await createOrUpdateTeamProgress(user.teamId, enigmaId, progressUpdates);
    }

    // If solved, update team solved count
    let newlyUnlockedParcours: any[] = [];
    if (isCorrect && !alreadySolved) {
      // Update team solved count (points removed - no longer tracked)
      const teamUpdates = {
        solvedEnigmasCount: (team.solvedEnigmasCount || 0) + 1,
      };
      await updateTeam(user.teamId, teamUpdates);

      // Check for parcours unlocks
      const allParcours = await getAllParcours();
      const teamProgress = await getAllTeamProgress(user.teamId);
      const solvedEnigmaIds = teamProgress
        .filter((p: any) => p.solved)
        .map((p: any) => p.enigmaId);

      for (const parcours of allParcours) {
        // Check if team already has access
        const existingAccess = await getTeamParcoursAccess(user.teamId, parcours.parcoursId);
        if (existingAccess && existingAccess.hasAccess) {
          continue; // Already unlocked
        }

        // Check if team has solved required enigmas
        const solvedRequiredCount = parcours.requiredEnigmaIds.filter((id: string) =>
          solvedEnigmaIds.includes(id)
        ).length;

        if (solvedRequiredCount >= parcours.requiredEnigmasCount) {
          // Grant access to parcours
          await grantParcoursAccess({
            teamId: user.teamId,
            parcoursId: parcours.parcoursId,
            hasAccess: true,
            unlockedAt: now,
            unlockedBy: parcours.requiredEnigmaIds.filter((id: string) => solvedEnigmaIds.includes(id)),
            createdAt: now,
          });

          newlyUnlockedParcours.push({
            parcoursId: parcours.parcoursId,
            title: parcours.title,
            parcoursNumber: parcours.parcoursNumber,
          });
        }
      }
    }

    // Simple response: just success status and message
    return success({
      success: isCorrect,
      message: isCorrect
        ? (alreadySolved ? 'Bravo, c\'est le bon mot de passe ! (Cette énigme était déjà résolue par votre équipe)' : 'Bravo ! Énigme résolue !')
        : getRandomErrorMessage(),
    });
  } catch (err: any) {
    console.error('Error submitting password attempt:', err);
    return error(err.message || 'Failed to submit password attempt');
  }
};
