# Stripe Webhook Setup Guide

## Overview

The Rallye d'Hiver backend uses Stripe webhooks to automatically update team payment status when a payment is completed.

## Webhook Configuration

### Webhook URL

**Production**: `https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod/payments/webhook`

### Required Event

The webhook must listen for: `checkout.session.completed`

## Setup Steps

### 1. Access Stripe Dashboard

- Go to: https://dashboard.stripe.com/test/webhooks (for test mode)
- Or: https://dashboard.stripe.com/webhooks (for live mode)

### 2. Add Endpoint

1. Click **"Add endpoint"**
2. Enter the webhook URL from above
3. Add description: "Rallye d'Hiver Payment Webhook"
4. Click **"Select events"**
5. Search for and select: `checkout.session.completed`
6. Click **"Add endpoint"**

### 3. Get Signing Secret

After creating the endpoint:
1. Stripe will display a **Signing secret** (format: `whsec_...`)
2. Copy this secret
3. Update your environment variables (see below)

### 4. Update Environment Variables (if needed)

If the signing secret changed, update the Lambda function:

```bash
AWS_PROFILE=claude-admin aws lambda update-function-configuration \
  --function-name rallye-hiver-backend-prod-stripeWebhook \
  --region eu-west-1 \
  --environment "Variables={
    STRIPE_SECRET_KEY=<your-stripe-secret-key>,
    STRIPE_WEBHOOK_SECRET=<new-webhook-secret>,
    STRIPE_PRICE_ID=<your-price-id>
  }"
```

Or update in `serverless.yml` and redeploy:

```yaml
provider:
  environment:
    STRIPE_WEBHOOK_SECRET: whsec_your_new_secret_here
```

Then redeploy:
```bash
AWS_PROFILE=claude-admin npm run deploy
```

## Testing

### Test with Stripe CLI

Install Stripe CLI: https://stripe.com/docs/stripe-cli

```bash
# Forward webhooks to local
stripe listen --forward-to https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod/payments/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

### Test with Real Payment

1. Log in to your app
2. Create or join a team (as leader)
3. Click "Payer maintenant"
4. Use Stripe test card: `4242 4242 4242 4242`
5. Complete payment
6. Check team status should update to `hasPaid: true`

### Verify Webhook Delivery

After a payment, check:
1. **Stripe Dashboard**: https://dashboard.stripe.com/test/events
   - Look for `checkout.session.completed` event
   - Click on it to see webhook delivery status
2. **CloudWatch Logs**:
   ```bash
   AWS_PROFILE=claude-admin aws logs tail /aws/lambda/rallye-hiver-backend-prod-stripeWebhook --follow --region eu-west-1
   ```

## Troubleshooting

### Webhook Not Firing

**Check Stripe Dashboard:**
- Go to: https://dashboard.stripe.com/test/webhooks
- Click on your endpoint
- Check "Recent deliveries" for errors

**Common Issues:**
1. **404 Not Found**: Webhook URL is incorrect
2. **401/403 Unauthorized**: Signing secret mismatch
3. **No deliveries**: Event type not selected

### Payment Completed But Team Not Updated

**Check Lambda logs:**
```bash
AWS_PROFILE=claude-admin aws logs tail /aws/lambda/rallye-hiver-backend-prod-stripeWebhook --since 1h --region eu-west-1
```

**Common causes:**
- Webhook signature verification failed
- Team ID not in session metadata
- DynamoDB update failed

### Current Configuration

**Webhook URL**: `https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod/payments/webhook`

**Current Environment Variables:**
- `STRIPE_SECRET_KEY`: `rk_test_51SP2XeFujfDconi4...` (test mode)
- `STRIPE_WEBHOOK_SECRET`: `whsec_2b3RvIbQDzOL66IEBOeNR4ZtYh8xlnTj` (updated 2025-11-16)
- `STRIPE_PRICE_ID`: `price_1SP2YkFujfDconi4FUEsV6eq`

## What Happens When Webhook Fires

1. Stripe sends `checkout.session.completed` event to webhook URL
2. Lambda function verifies signature using `STRIPE_WEBHOOK_SECRET`
3. Extracts `teamId` from session metadata
4. Updates team in DynamoDB:
   - `hasPaid = true`
   - `stripePaymentId = <payment_intent_id>`
   - `paidAt = <timestamp>`
   - `points = 0`
   - `solvedEnigmasCount = 0`
   - `lastActivityAt = <timestamp>`
5. Returns success response to Stripe

## Security

- Webhook signature verification ensures requests are from Stripe
- Signing secret must match between Stripe Dashboard and Lambda environment
- Never expose signing secret in client-side code
- Use HTTPS only (enforced by API Gateway)

## Production Checklist

Before going live:
- [ ] Create webhook in Stripe **live mode** dashboard
- [ ] Use live mode API keys (starts with `rk_live_`)
- [ ] Update `STRIPE_WEBHOOK_SECRET` with live mode secret
- [ ] Test with real (small amount) payment
- [ ] Monitor CloudWatch logs for errors
- [ ] Set up Stripe webhook monitoring/alerts
