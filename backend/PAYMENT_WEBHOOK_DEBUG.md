# Payment Webhook Debugging Guide

## Issue
Payment completes in Stripe but team's `hasPaid` status is not updated, preventing content access.

## Fixes Applied

### 1. Team Creation - Initialize Game Fields
**File**: `/src/functions/teams/create.ts`
**Change**: Added `points: 0` and `solvedEnigmasCount: 0` to team creation

### 2. Payment Webhook - Initialize Game Fields
**File**: `/src/functions/payments/webhook.ts`
**Change**: Added initialization of game fields when payment completes:
```typescript
{
  hasPaid: true,
  stripePaymentId: paymentIntentId,
  paidAt: now,
  points: 0,                    // NEW
  solvedEnigmasCount: 0,        // NEW
  lastActivityAt: now,          // NEW
}
```

---

## Debugging Steps

### 1. Check if Webhook is Being Called

**View CloudWatch Logs**:
```bash
aws logs tail /aws/lambda/rallye-hiver-backend-dev-stripeWebhook --follow --profile claude-admin
```

Look for:
- `Stripe webhook event:` - Webhook received
- `Checkout session completed:` - Payment successful
- `Team {teamId} payment completed` - Update successful
- Any error messages

### 2. Check Stripe Webhook Configuration

**List Stripe Webhooks**:
```bash
stripe webhooks list
```

**Expected Configuration**:
- Endpoint URL: `https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev/dev/payments/webhook`
- Events: `checkout.session.completed`
- Status: `enabled`

**Update if Needed**:
```bash
stripe listen --forward-to https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev/dev/payments/webhook
```

### 3. Test Webhook Manually

**Create Test Event**:
```bash
stripe trigger checkout.session.completed
```

Then check CloudWatch logs to see if webhook was called.

### 4. Check DynamoDB Directly

**Get Team Record**:
```bash
aws dynamodb get-item \
  --table-name rallye-hiver-backend-teams-dev \
  --key '{"teamId": {"S": "YOUR_TEAM_ID"}}' \
  --profile claude-admin
```

Look for:
- `hasPaid: { BOOL: true }` - Should be true after payment
- `paidAt: { S: "timestamp" }` - Should have timestamp
- `points: { N: "0" }` - Should exist
- `solvedEnigmasCount: { N: "0" }` - Should exist

### 5. Check Webhook Signature Verification

If logs show signature verification errors:

1. **Verify Webhook Secret**:
   ```bash
   # Get the secret from Stripe dashboard
   stripe webhooks list
   ```

2. **Update Environment Variable**:
   ```bash
   # Make sure STRIPE_WEBHOOK_SECRET matches Stripe's signing secret
   export STRIPE_WEBHOOK_SECRET=whsec_...
   npm run deploy:dev
   ```

### 6. Test Payment Flow End-to-End

1. **Create Team**: `POST /teams`
2. **Check Team Status**: Verify `hasPaid: false`
3. **Create Checkout**: `POST /payments/create-checkout`
4. **Complete Payment**: Use Stripe test card `4242 4242 4242 4242`
5. **Wait for Webhook**: Should process within seconds
6. **Check Team Status**: Verify `hasPaid: true`
7. **Test Content Access**: `GET /content/check-access`

---

## Common Issues

### Issue 1: Webhook Secret Mismatch
**Symptom**: Logs show "Webhook signature verification failed"
**Solution**: Update `STRIPE_WEBHOOK_SECRET` environment variable

### Issue 2: Webhook URL Not Configured in Stripe
**Symptom**: Payment completes but webhook never called
**Solution**: Add webhook endpoint in Stripe Dashboard

### Issue 3: teamId Not in Metadata
**Symptom**: Logs show "No teamId in session metadata"
**Solution**: Verify `createCheckout.ts` passes teamId in metadata (already fixed)

### Issue 4: DynamoDB Update Fails
**Symptom**: Webhook called but team not updated
**Solution**: Check IAM permissions for Lambda to update DynamoDB

### Issue 5: Existing Teams Without Game Fields
**Symptom**: Old teams can't access content even after paying
**Solution**: Manually update old teams or have them create new teams

---

## Manual Fix for Existing Teams

If teams paid before the fix and still can't access content:

```bash
aws dynamodb update-item \
  --table-name rallye-hiver-backend-teams-dev \
  --key '{"teamId": {"S": "TEAM_ID_HERE"}}' \
  --update-expression "SET points = :p, solvedEnigmasCount = :s, lastActivityAt = :l" \
  --expression-attribute-values '{
    ":p": {"N": "0"},
    ":s": {"N": "0"},
    ":l": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}
  }' \
  --profile claude-admin
```

Or use DynamoDB console to add these fields manually:
- `points` (Number): 0
- `solvedEnigmasCount` (Number): 0
- `lastActivityAt` (String): Current timestamp

---

## Verification Checklist

After fixes:
- [ ] Webhook logs show "Team {id} payment completed and game fields initialized"
- [ ] DynamoDB shows `hasPaid: true` for paid teams
- [ ] DynamoDB shows `points`, `solvedEnigmasCount`, `lastActivityAt` fields
- [ ] `/content/check-access` returns success for paid teams
- [ ] Teams can submit password attempts after payment

---

## Monitoring

Set up CloudWatch alarms for:
1. Webhook function errors
2. Webhook invocation count (should match payment count)
3. DynamoDB write throttling
4. Failed payment updates

**Create Alarm**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name webhook-errors \
  --alarm-description "Alert on webhook errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=rallye-hiver-backend-dev-stripeWebhook \
  --profile claude-admin
```

---

## Contact Support

If issue persists after all debugging:
1. Check CloudWatch logs: `/aws/lambda/rallye-hiver-backend-dev-stripeWebhook`
2. Check Stripe webhook logs: Stripe Dashboard > Developers > Webhooks
3. Verify DynamoDB table state
4. Share relevant log snippets
