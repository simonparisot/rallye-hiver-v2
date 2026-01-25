# Rallye d'Hiver - Backend API

Node.js serverless backend for the Rallye d'Hiver enigma game platform.

## Architecture

- **Runtime**: AWS Lambda (Node.js 20.x)
- **API Gateway**: HTTP API with Lambda authorizer
- **Database**: DynamoDB (2 tables: Users, Teams)
- **Authentication**: Cognito User Pools
- **Payment**: Stripe API

## Directory Structure

```
backend/
├── src/
│   ├── functions/
│   │   ├── authorizer.ts         # JWT validation
│   │   ├── auth/                 # Auth endpoints
│   │   │   ├── signup.ts
│   │   │   ├── login.ts
│   │   │   └── me.ts
│   │   ├── teams/                # Team management
│   │   │   ├── create.ts
│   │   │   ├── list.ts
│   │   │   ├── get.ts
│   │   │   ├── join.ts
│   │   │   ├── approve.ts
│   │   │   ├── reject.ts
│   │   │   └── removeMember.ts
│   │   ├── payments/             # Stripe integration
│   │   │   ├── createCheckout.ts
│   │   │   └── webhook.ts
│   │   └── content/              # Content access
│   │       ├── checkAccess.ts
│   │       └── enigma.ts
│   ├── utils/
│   │   ├── dynamodb.ts           # DynamoDB helpers
│   │   ├── cognito.ts            # Cognito helpers
│   │   └── response.ts           # HTTP response helpers
│   └── types/
│       └── index.ts              # TypeScript types
├── serverless.yml                # Infrastructure as code
├── tsconfig.json
└── package.json
```

## Local Development

### Install Dependencies

```bash
npm install
```

### Run Offline

```bash
npm run offline
```

This starts the API at `http://localhost:3001` using serverless-offline.

### Environment Variables

Create `.env` file:

```bash
COGNITO_USER_POOL_ID=<from deployment>
COGNITO_CLIENT_ID=<from deployment>
COGNITO_REGION=eu-west-1
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_1SOpLt2E4Pf8JclVHxFAvMeE
CORS_ORIGIN=http://localhost:3000
```

## Deployment

### Prerequisites

Ensure AWS credentials are configured. This project uses the `claude-admin` profile with SSO:

```bash
# Login to AWS SSO (required before first deployment or when session expires)
aws sso login --profile claude-admin

# Verify AWS profile is configured
aws configure list --profile claude-admin
```

### Deploy (Single Environment)

This project uses a **single production environment** (no dev/prod separation):

```bash
AWS_PROFILE=claude-admin npm run deploy
```

The API will be available at:
```
https://{api-id}.execute-api.eu-west-1.amazonaws.com/prod
```

**Note**: The `/prod` path is required by AWS API Gateway stage naming.

### View Logs

```bash
serverless logs -f <function-name> --tail
```

Example:
```bash
serverless logs -f login --tail
```

## API Documentation

### Authentication Flow

1. **Signup**: `POST /auth/signup`
   - Creates Cognito user
   - Creates DynamoDB user record
   - Returns user info

2. **Login**: `POST /auth/login`
   - Authenticates with Cognito
   - Returns JWT tokens
   - Frontend stores tokens in localStorage

3. **Protected Routes**: All other endpoints
   - Require `Authorization: Bearer <token>` header
   - Lambda authorizer validates JWT
   - Adds user info to request context

### Database Schema

#### Users Table
```
PK: userId (UUID)
Attributes:
- cognitoSub (string, GSI)
- email (string)
- displayName (string)
- teamId (string | null)
- role ('leader' | 'member' | null)
- createdAt (ISO timestamp)
- updatedAt (ISO timestamp)
```

#### Teams Table
```
PK: teamId (UUID)
Attributes:
- teamName (string)
- leaderId (string - userId)
- hasPaid (boolean)
- stripePaymentId (string | null)
- members (string array - userIds)
- pendingRequests (string array - userIds)
- createdAt (ISO timestamp)
- paidAt (ISO timestamp | null)
```

## Business Logic

### Team Creation
- User must not already be in a team
- User becomes team leader
- Team starts with `hasPaid: false`

### Joining Teams
- User must not be in a team
- Adds user to team's `pendingRequests`
- Any team member can approve/reject

### Payment
- Only team leader can initiate
- Team must not have already paid
- Creates Stripe Checkout session
- Webhook updates team on success

### Content Access
- User must be in a team
- Team must have `hasPaid: true`

## Error Handling

All functions return standardized responses:

**Success** (200/201):
```json
{
  "data": { ... }
}
```

**Error** (4xx/5xx):
```json
{
  "error": "Error message"
}
```

## Security

- JWT validation on all protected endpoints
- Stripe webhook signature verification
- Input validation on all requests
- CORS restricted to frontend domain
- Secrets in environment variables
- Least-privilege IAM roles

## Monitoring

- CloudWatch Logs for all Lambda functions
- DynamoDB metrics in CloudWatch
- API Gateway access logs
- Stripe dashboard for payments

## Troubleshooting

### Common Issues

**"User not found in database" after login**
- User may have been created in Cognito but not DynamoDB
- Check signup function logs
- Manually verify user exists in DynamoDB

**Stripe webhook not triggering**
- Verify webhook URL is correct
- Check webhook signing secret
- Review Stripe dashboard events

**CORS errors**
- Update `CORS_ORIGIN` environment variable
- Redeploy backend
