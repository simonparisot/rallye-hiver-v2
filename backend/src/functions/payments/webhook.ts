import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import { updateTeam } from '../../utils/dynamodb';
import { successResponse, errorResponse } from '../../utils/response';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Stripe webhook event:', JSON.stringify(event, null, 2));

  try {
    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

    if (!sig) {
      return errorResponse('No signature provided', 400);
    }

    // Verify webhook signature
    let stripeEvent: Stripe.Event;

    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body || '',
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return errorResponse(`Webhook Error: ${err.message}`, 400);
    }

    // Handle the event
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;

      console.log('Checkout session completed:', session);

      const teamId = session.metadata?.teamId;
      const paymentIntentId = session.payment_intent as string;

      if (!teamId) {
        console.error('No teamId in session metadata');
        return errorResponse('No teamId in session metadata', 400);
      }

      // Update team payment status and initialize game fields
      const now = new Date().toISOString();
      await updateTeam(teamId, {
        hasPaid: true,
        stripePaymentId: paymentIntentId,
        paidAt: now,
        points: 0,
        solvedEnigmasCount: 0,
        lastActivityAt: now,
      });

      console.log(`Team ${teamId} payment completed and game fields initialized`);
    }

    return successResponse({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return errorResponse(error.message || 'Webhook handler failed', 500);
  }
};
