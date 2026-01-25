import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import { getTeamById } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create checkout event:', JSON.stringify(event, null, 2));

  try {
    const userId = event.requestContext?.authorizer?.userId;
    const body = JSON.parse(event.body || '{}');
    const { teamId } = body;

    console.log('UserId from authorizer:', userId);
    console.log('TeamId from body:', teamId);

    if (!teamId) {
      return errorResponse('Team ID is required', 400);
    }

    // Get team
    const team = await getTeamById(teamId);

    if (!team) {
      return errorResponse('Team not found', 404);
    }

    console.log('Team leaderId:', team.leaderId);
    console.log('Team members:', team.members);

    // Check if requester is a member of the team (leader or regular member)
    const isTeamMember = team.leaderId === userId || team.members.includes(userId);

    if (!isTeamMember) {
      console.log('403 - User is not a team member');
      return errorResponse('Only team members can initiate payment', 403);
    }

    console.log('User is team member, proceeding with checkout');

    // Check if team has already paid
    if (team.hasPaid) {
      return errorResponse('Team has already paid', 400);
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CORS_ORIGIN}/team/${teamId}?payment=success`,
      cancel_url: `${process.env.CORS_ORIGIN}/team/${teamId}?payment=cancelled`,
      metadata: {
        teamId: teamId,
      },
    });

    return successResponse({
      checkoutUrl: session.url,
    });
  } catch (error: any) {
    console.error('Create checkout error:', error);
    return errorResponse(error.message || 'Failed to create checkout session', 500);
  }
};
