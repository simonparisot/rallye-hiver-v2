import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserById, getTeamById } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get enigma event:', JSON.stringify(event, null, 2));

  try {
    const userId = event.requestContext?.authorizer?.userId;

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    // Get user
    const user = await getUserById(userId);

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Check if user has a team
    if (!user.teamId) {
      return errorResponse('You must be part of a team to access content', 403);
    }

    // Get team
    const team = await getTeamById(user.teamId);

    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Check if team has paid
    if (!team.hasPaid) {
      return errorResponse('Your team must complete payment to access content', 403);
    }

    // Return enigma content (placeholder for now)
    const enigmaData = {
      title: 'Rallye d\'Hiver 2025',
      description: 'Bienvenue au Rallye d\'Hiver ! Votre aventure commence ici.',
      enigmas: [
        {
          id: 1,
          title: 'Énigme 1',
          content: 'Contenu de l\'énigme 1...',
          hint: 'Un indice pour vous aider...',
        },
        {
          id: 2,
          title: 'Énigme 2',
          content: 'Contenu de l\'énigme 2...',
          hint: 'Un autre indice...',
        },
      ],
    };

    return successResponse({
      enigmaData,
    });
  } catch (error: any) {
    console.error('Get enigma error:', error);
    return errorResponse(error.message || 'Failed to get enigma', 500);
  }
};
