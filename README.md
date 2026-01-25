# Rallye d'Hiver - MVP Application

A web application for the annual French enigma game "Rallye d'Hiver" where users can create or join teams and access game content after payment.

## Project Structure

```
rallyehiver-v2/
├── backend/              # Node.js serverless backend
│   ├── src/
│   │   ├── functions/   # Lambda function handlers
│   │   ├── utils/       # Utility functions
│   │   └── types/       # TypeScript types
│   ├── serverless.yml   # Serverless Framework configuration
│   └── package.json
├── frontend/            # React TypeScript frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts (Auth)
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   └── types/       # TypeScript types
│   └── package.json
├── tests/               # Functional tests
├── api-contract/        # Legacy API docs (see API_CONTRACT.md)
└── .claude/             # Claude Code agent coordination
    └── archive/         # Historical documentation
```

## Documentation

### Coordination Files (for Claude Code agents)
- **CLAUDE.md** - Agent coordination guide and workflow
- **API_CONTRACT.md** - Complete API specification (single source of truth)
- **DATA_MODELS.md** - Database schemas and entity relationships
- **FRONTEND_REQUIREMENTS.md** - Frontend needs, blockers, and questions
- **DECISIONS.md** - Architectural decisions and rationale
- **COORDINATION-LOG.md** - Daily sync and status updates

### Project Documentation
- **README.md** - This file (project overview and setup)
- **SPECIFICATION.md** - Original technical specification
- **FRONTEND_INTEGRATION_GUIDE.md** - Backend→Frontend integration how-to
- **NEWFEATURES.md** - Feature requests and roadmap

## Tech Stack

### Backend
- **Runtime**: Node.js 20.x on AWS Lambda
- **Framework**: Serverless Framework v4
- **Database**: AWS DynamoDB (pay-per-request)
- **Authentication**: AWS Cognito User Pools
- **Payment**: Stripe Checkout
- **API**: AWS API Gateway (HTTP API)

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query)
- **API Client**: Axios
- **Styling**: CSS (mobile-first, responsive)
- **Hosting**: AWS S3 + CloudFront

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- Serverless Framework CLI: `npm install -g serverless`
- Stripe account with API keys

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
COGNITO_USER_POOL_ID=<will-be-created-on-deploy>
COGNITO_CLIENT_ID=<will-be-created-on-deploy>
COGNITO_REGION=eu-west-1
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_1SOpLt2E4Pf8JclVHxFAvMeE
CORS_ORIGIN=http://localhost:3000
```

### 3. Deploy Backend

```bash
# Deploy to dev environment
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

After deployment, note the outputs:
- `UserPoolId`: Copy to `.env` as `COGNITO_USER_POOL_ID`
- `UserPoolClientId`: Copy to `.env` as `COGNITO_CLIENT_ID`
- `ApiEndpoint`: Your API base URL

### 4. Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://api.proto.rallyehiver.fr/payments/webhook`
3. Select event: `checkout.session.completed`
4. Copy webhook signing secret to `.env` as `STRIPE_WEBHOOK_SECRET`
5. Redeploy: `npm run deploy:prod`

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
REACT_APP_API_URL=https://api.proto.rallyehiver.fr
REACT_APP_COGNITO_USER_POOL_ID=<from-backend-deployment>
REACT_APP_COGNITO_CLIENT_ID=<from-backend-deployment>
REACT_APP_COGNITO_REGION=eu-west-1
```

### 3. Run Development Server

```bash
npm start
```

The app will open at `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
```

This creates an optimized build in the `build/` directory.

## Deployment to AWS

### Backend Deployment

The backend is deployed using Serverless Framework:

```bash
cd backend
serverless deploy --stage prod
```

This creates:
- Lambda functions for all API endpoints
- DynamoDB tables (Users, Teams)
- Cognito User Pool
- API Gateway HTTP API
- IAM roles and permissions

### Frontend Deployment (S3 + CloudFront)

1. **Create S3 Bucket**

```bash
aws s3 mb s3://proto.rallyehiver.fr --region eu-west-1 --profile claude
aws s3 website s3://proto.rallyehiver.fr --index-document index.html --error-document index.html --profile claude
```

2. **Configure Bucket Policy**

Create `bucket-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::proto.rallyehiver.fr/*"
    }
  ]
}
```

Apply policy:

```bash
aws s3api put-bucket-policy --bucket proto.rallyehiver.fr --policy file://bucket-policy.json --profile claude
```

3. **Build and Upload**

```bash
cd frontend
npm run build
aws s3 sync build/ s3://proto.rallyehiver.fr --delete --profile claude
```

4. **Create CloudFront Distribution**

- Origin: `proto.rallyehiver.fr.s3-website-eu-west-1.amazonaws.com`
- Alternate domain: `proto.rallyehiver.fr`
- SSL Certificate: Use existing ACM certificate (f048b3d4-cb91-4ae7-bdd2-59a887b41602)
- Default root object: `index.html`
- Error pages: 404 → /index.html (for SPA routing)

5. **Configure Route 53**

Add A record for `proto.rallyehiver.fr` pointing to CloudFront distribution.

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new user account
- `POST /auth/login` - Login with email/password
- `GET /auth/me` - Get current user info

### Teams
- `POST /teams` - Create a new team
- `GET /teams` - List all teams
- `GET /teams/:teamId` - Get team details
- `POST /teams/:teamId/join` - Request to join team
- `POST /teams/:teamId/approve/:userId` - Approve join request
- `POST /teams/:teamId/reject/:userId` - Reject join request
- `DELETE /teams/:teamId/members/:userId` - Remove team member

### Payments
- `POST /payments/create-checkout` - Create Stripe checkout session
- `POST /payments/webhook` - Stripe webhook handler

### Content
- `GET /content/check-access` - Check if user has access
- `GET /content/enigma` - Get enigma content (requires access)

## User Flows

### Flow 1: Create Team → Pay → Access Content

1. User signs up/logs in
2. Creates a team (becomes leader)
3. Initiates payment via Stripe Checkout
4. After payment, team is marked as paid
5. All team members can access enigma content

### Flow 2: Join Existing Team

1. User signs up/logs in
2. Browses available teams
3. Requests to join a team
4. Team member approves request
5. User gains access (if team has paid)

## Testing Locally

### Backend (Serverless Offline)

```bash
cd backend
npm run offline
```

API will be available at `http://localhost:3001`

### Frontend

```bash
cd frontend
npm start
```

App will be available at `http://localhost:3000`

Make sure to update `REACT_APP_API_URL=http://localhost:3001` in `.env.local`

## Security Considerations

- All API endpoints (except public) require valid Cognito JWT token
- Stripe webhook signature verification prevents unauthorized payment updates
- CORS restricted to frontend domain
- Input validation on all user inputs
- Payment amount defined server-side (not trusted from client)

## Environment Variables Reference

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `COGNITO_USER_POOL_ID` | AWS Cognito User Pool ID | `eu-west-1_xxxxx` |
| `COGNITO_CLIENT_ID` | Cognito App Client ID | `xxxxx` |
| `COGNITO_REGION` | AWS Region | `eu-west-1` |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret | `whsec_...` |
| `STRIPE_PRICE_ID` | Stripe Price ID | `price_1SOpLt2E4Pf8JclVHxFAvMeE` |
| `CORS_ORIGIN` | Frontend domain | `https://proto.rallyehiver.fr` |

### Frontend (.env.local)

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `https://api.proto.rallyehiver.fr` |
| `REACT_APP_COGNITO_USER_POOL_ID` | Cognito User Pool ID | `eu-west-1_xxxxx` |
| `REACT_APP_COGNITO_CLIENT_ID` | Cognito Client ID | `xxxxx` |
| `REACT_APP_COGNITO_REGION` | AWS Region | `eu-west-1` |

## Troubleshooting

### Backend Issues

**Lambda timeout errors**
- Check CloudWatch logs: `serverless logs -f <function-name>`
- Increase timeout in `serverless.yml` if needed

**DynamoDB access denied**
- Verify IAM role permissions in `serverless.yml`
- Check table names match environment variables

### Frontend Issues

**CORS errors**
- Verify `CORS_ORIGIN` in backend `.env`
- Check API Gateway CORS configuration

**Authentication fails**
- Verify Cognito User Pool ID and Client ID
- Check if user exists in Cognito console

**Payment not updating**
- Verify Stripe webhook is configured correctly
- Check webhook signature secret matches
- Review Lambda logs for webhook function

## License

All rights reserved - Rallye d'Hiver 2025
