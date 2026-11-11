import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { updateEnigma, getEnigmaById } from '../../utils/dynamodb';
import { requireAdmin } from '../../utils/adminAuth';
import { success, error } from '../../utils/response';
import { lireReglageIndices } from '../../utils/hintAvailability';
import { lireNearMisses, conflitAvecMotDePasse } from '../../utils/nearMisses';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    const enigmaId = event.pathParameters?.enigmaId;

    if (!enigmaId) {
      return error('Missing enigmaId parameter', 400);
    }

    const existingEnigma = await getEnigmaById(enigmaId);
    if (!existingEnigma) {
      return error('Enigma not found', 404);
    }

    const body = JSON.parse(event.body || '{}');

    // Build updates object with allowed fields
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.pdfUrl !== undefined) updates.pdfUrl = body.pdfUrl;
    if (body.solution !== undefined) updates.solution = body.solution;
    if (body.hints !== undefined) updates.hints = Array.isArray(body.hints) ? body.hints : [];
    if (body.correctPassword !== undefined) updates.correctPassword = body.correctPassword;
    if (body.points !== undefined) updates.points = body.points;
    if (body.difficulty !== undefined) updates.difficulty = body.difficulty;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.enigmaNumber !== undefined) updates.enigmaNumber = body.enigmaNumber;

    // Ouverture des indices : un interrupteur et une date facultative.
    const reglage = lireReglageIndices(body);
    if (reglage.erreur) return error(reglage.erreur, 400);
    Object.assign(updates, reglage.valeurs);

    // « Presque bons » : absents du corps, ceux qui existent restent (une
    // bascule des indices n'envoie que `hintsEnabled`). Présents, ils
    // remplacent la liste entière. Dans les deux cas, aucun ne doit égaler le
    // mot de passe tel qu'il sera après l'écriture.
    const motDePasse = updates.correctPassword ?? existingEnigma.correctPassword;
    if (body.nearMisses !== undefined) {
      const presqueBons = lireNearMisses(body.nearMisses, motDePasse);
      if (presqueBons.erreur) return error(presqueBons.erreur, 400);
      updates.nearMisses = presqueBons.valeur;
    } else if (updates.correctPassword !== undefined) {
      const conflit = conflitAvecMotDePasse(existingEnigma.nearMisses, motDePasse);
      if (conflit) return error(conflit, 400);
    }

    const updatedEnigma = await updateEnigma(enigmaId, updates);

    return success({
      message: 'Enigma updated successfully',
      enigma: updatedEnigma,
    });
  } catch (err: any) {
    console.error('Error updating enigma:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to update enigma');
  }
};
