# ENIGMA GAME PLATFORM - TECHNICAL SPECIFICATION

## OVERVIEW
Build a web application for an annual french enigma game (le Rallye d'Hiver) where users must join or create teams and pay a one-time fee to access game content.

## TECH STACK
- **Frontend:** React (mobile-first), hosted on AWS S3 + CloudFront
- **Backend:** Node.js on AWS Lambda + API Gateway
- **Database:** AWS DynamoDB
- **Auth:** AWS Cognito User Pools + AWS SDK
- **Payment:** Stripe Checkout (one-time payment)
- **Infrastructure:** Serverless Framework or AWS SAM (your choice)

---

## DATABASE SCHEMA (DynamoDB)

### Table 1: Users
```
PK: userId (UUID)
Attributes:
- cognitoSub (string, indexed)
- email (string)
- displayName (string)
- teamId (string | null)
- role (string: 'leader' | 'member' | null)
- createdAt (ISO timestamp)
- updatedAt (ISO timestamp)

GSI: cognitoSub-index (for lookup by Cognito user)
```

### Table 2: Teams
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

GSI: None needed for MVP
```

### Table 3: JoinRequests (Optional - can be embedded in Teams.pendingRequests)
```
PK: requestId (UUID)
Attributes:
- teamId (string)
- userId (string)
- status (string: 'pending' | 'approved' | 'rejected')
- createdAt (ISO timestamp)
- respondedAt (ISO timestamp | null)
- respondedBy (string - userId who approved/rejected)
```

---

## AUTH REQUIREMENTS (Cognito)

### Cognito User Pool Configuration
- Enable email/password sign-up
- Enable social login: Google (minimum), optionally Facebook
- Email verification required
- Password policy: min 8 characters, requires uppercase, lowercase, number
- MFA: Disabled for MVP
- No custom attributes needed

### Frontend Auth Implementation
- Use `amazon-cognito-identity-js` or `@aws-amplify/auth` (lightweight config)
- Store JWT tokens in localStorage
- Implement token refresh logic
- Auth context/provider in React

### Backend Auth
- Lambda authorizer that validates Cognito JWT
- Extract `cognitoSub` from token
- All API endpoints (except public ones) require valid JWT

---

## API ENDPOINTS

### Auth Endpoints
```
POST /auth/signup
Body: { email, password, displayName }
Response: { message: "Verification email sent" }

POST /auth/login
Body: { email, password }
Response: { accessToken, refreshToken, user }

POST /auth/social-login
Body: { provider, token }
Response: { accessToken, refreshToken, user }

GET /auth/me
Headers: Authorization: Bearer <token>
Response: { userId, email, displayName, teamId, role }
```

### Team Endpoints
```
POST /teams
Headers: Authorization: Bearer <token>
Body: { teamName }
Response: { teamId, teamName, leaderId, members: [userId] }
Action: Create team, set user as leader, update user.teamId and user.role

GET /teams
Headers: Authorization: Bearer <token>
Query: ?limit=50&nextToken=abc
Response: { teams: [...], nextToken }
Action: List all teams (paginated), show teamName, memberCount, hasPaid

GET /teams/:teamId
Headers: Authorization: Bearer <token>
Response: { teamId, teamName, leaderId, members: [{userId, displayName}], hasPaid, pendingRequests: [{userId, displayName}] }
Action: Get team details. Only show pendingRequests if user is leader or member

POST /teams/:teamId/join
Headers: Authorization: Bearer <token>
Response: { message: "Join request sent" }
Action: Add userId to team.pendingRequests
Validation: User must not already be in a team

POST /teams/:teamId/approve/:userId
Headers: Authorization: Bearer <token>
Response: { message: "User approved" }
Action: Remove userId from pendingRequests, add to members array, update user.teamId and user.role='member'
Authorization: Only team leader OR team members can approve

POST /teams/:teamId/reject/:userId
Headers: Authorization: Bearer <token>
Response: { message: "User rejected" }
Action: Remove userId from pendingRequests
Authorization: Only team leader OR team members can reject

DELETE /teams/:teamId/members/:userId
Headers: Authorization: Bearer <token>
Response: { message: "Member removed" }
Action: Remove member from team, set their teamId=null, role=null
Authorization: Only team leader can remove members (NOT themselves)
Validation: Cannot remove the leader
```

### Payment Endpoints
```
POST /payments/create-checkout
Headers: Authorization: Bearer <token>
Body: { teamId }
Response: { checkoutUrl }
Action: Create Stripe Checkout session, return URL
Authorization: Only team leader can initiate payment
Validation: Team must not have already paid

POST /payments/webhook
Headers: stripe-signature
Body: Stripe webhook event
Response: { received: true }
Action: On checkout.session.completed, update team.hasPaid=true, team.stripePaymentId=paymentIntentId, team.paidAt=now
Note: No auth required, validate Stripe signature
```

### Content Endpoints
```
GET /content/check-access
Headers: Authorization: Bearer <token>
Response: { hasAccess: boolean, reason?: string }
Action: Check if user.teamId exists AND team.hasPaid=true

GET /content/enigma
Headers: Authorization: Bearer <token>
Response: { enigmaData: {...} }
Action: Return enigma content
Authorization: User must have access (via check-access logic)
```

---

## BUSINESS LOGIC RULES

### Team Creation
1. User must be authenticated
2. User must NOT already be in a team
3. Creates team with user as leader
4. Sets user.teamId and user.role='leader'

### Joining a Team
1. User must be authenticated
2. User must NOT already be in a team
3. User cannot request to join a team they're already pending in
4. Adds user to team.pendingRequests

### Approving Members
1. Requester must be team leader OR existing team member
2. Target user must be in pendingRequests
3. Removes from pendingRequests, adds to members
4. Sets target user.teamId and user.role='member'

### Payment
1. Only team leader can initiate payment
2. Team must not have already paid
3. Uses Stripe Checkout (one-time payment)
4. Webhook updates team.hasPaid after successful payment
5. **CRITICAL:** Payment amount is stored in backend config, NOT passed from frontend

### Content Access
1. User must be authenticated
2. User must have a teamId
3. Team must have hasPaid=true
4. Leader leaving is blocked (return error if leader tries to leave)

---

## FRONTEND REQUIREMENTS

### Pages/Routes
```
/ - Landing page (public)
/login - Login page
/signup - Signup page
/dashboard - Main dashboard after login
/team/create - Create team form
/team/browse - Browse all teams
/team/:teamId - Team detail page
/team/:teamId/payment - Payment page (leader only)
/content - Enigma content (access-gated)
```

### Mobile-First UI Components Needed
- Auth forms (login, signup, social buttons)
- Team list (card-based, shows name, member count, paid status)
- Team detail view (members list, pending requests, action buttons)
- Join request modal/button
- Payment flow (redirect to Stripe, handle return)
- Content viewer (locked state vs unlocked)
- Navigation (bottom nav or hamburger menu)

### State Management
- Use React Context for auth state
- Use React Query or SWR for API calls (recommended)
- Loading states and error handling for all API calls

### Key User Flows

**Flow 1: Create Team → Pay → Access Content**
1. Login → Dashboard → "Create Team" button
2. Enter team name → Submit
3. Redirected to team page → "Pay to unlock" button
4. Redirect to Stripe → Complete payment
5. Return to site → Access content

**Flow 2: Join Existing Team → Wait → Access Content**
1. Login → Dashboard → "Browse Teams" button
2. View teams → Select team → "Request to Join"
3. Wait for approval (show pending status)
4. Once approved → Access content (if team paid)

**Flow 3: Leader Approves Members**
1. Leader views team page
2. Sees pending requests section
3. Clicks approve/reject on each request

---

## ENVIRONMENT VARIABLES

### Frontend (.env)
```
REACT_APP_API_URL=https://api.proto.rallyehiver.fr
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_xxxxx
REACT_APP_COGNITO_CLIENT_ID=xxxxx
REACT_APP_COGNITO_REGION=us-east-1
REACT_APP_GOOGLE_CLIENT_ID=xxxxx (for social login)
```

### Backend (.env)
```
COGNITO_USER_POOL_ID=us-east-1_xxxxx
COGNITO_CLIENT_ID=xxxxx
COGNITO_REGION=us-east-1
DYNAMODB_USERS_TABLE=enigma-users-prod
DYNAMODB_TEAMS_TABLE=enigma-teams-prod
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_ID=price_1SOpLt2E4Pf8JclVHxFAvMeE (for the game fee product)
CORS_ORIGIN=https://proto.rallyehiver.fr
```

---

## STRIPE SETUP INSTRUCTIONS

I have access to the Stripe account. Ask me if you need some credentials or for me to do something on the stripe console.
1. A Stripe product (`prod_TLWOGHAgqQ10EF`) is already created, the `PRICE_ID` is: `price_1SOpLt2E4Pf8JclVHxFAvMeE`
2. Create webhook endpoint pointing to `/payments/webhook`
3. Listen for event: `checkout.session.completed`
4. Note the webhook secret (starts with `whsec_`)


---

## DEPLOYMENT REQUIREMENTS

### Frontend (S3 + CloudFront)
- Build React app (`npm run build`)
- Upload to S3 bucket with static website hosting
- CloudFront distribution pointing to S3
- Custom domain: proto.rallyehiver.fr
- Enforce HTTPS
- An SSL certificate is already created and available on AWS Certificate Manager for domains proto.rallyehiver.fr and api.proto.rallyehiver.fr. Id is f048b3d4-cb91-4ae7-bdd2-59a887b41602.

### Backend (Lambda + API Gateway)
- Use Serverless Framework or AWS SAM
- Deploy Lambda functions behind API Gateway
- Enable CORS for frontend domain
- Set up custom domain for API: api.proto.rallyehiver.fr
- Configure environment variables

### DynamoDB
- Create tables with on-demand billing (pay-per-request)
- Set up GSI for Users table (cognitoSub-index)

### Cognito
- Create User Pool
- Configure app client (no secret needed for SPA)
- Set up Google OAuth (get client ID/secret from Google Console)
- Configure callback URLs for frontend

---

## TESTING REQUIREMENTS

### Backend Unit Tests
- Test team creation logic
- Test join request flow
- Test approval/rejection logic
- Test payment webhook handling
- Test access control logic

### Frontend Tests (Optional for MVP)
- Test auth flows
- Test team creation/joining
- Smoke tests for major pages

---

## SECURITY CONSIDERATIONS

1. **Auth:** All API endpoints except public ones require valid Cognito JWT
2. **Authorization:** Check user permissions (leader vs member) on protected actions
3. **Payment:** Validate Stripe webhook signature, never trust client-side payment data
4. **CORS:** Restrict to your frontend domain only
5. **Rate Limiting:** Consider API Gateway throttling (10 requests/second for MVP)
6. **Input Validation:** Validate all user inputs (team names, etc.)

---

## MVP SCOPE - WHAT TO SKIP

- Team search/filtering (just show all teams)
- Team chat/messaging
- User profiles beyond basic info
- Team analytics/leaderboards
- Multiple games/editions support (hardcode current year)
- Admin panel (manage via AWS console for MVP)
- Email notifications (add later)
- Password reset (Cognito handles this, just link to it)

---

## MVP SCOPE - WHAT TO BUILD

✅ Auth (email + Google social login)
✅ Create team
✅ Browse teams
✅ Join team (request + approval by any member)
✅ Payment (Stripe Checkout)
✅ Content access gating
✅ Mobile-responsive UI

---

## DELIVERABLES

1. **Backend:**
   - Lambda functions for all endpoints
   - DynamoDB table definitions
   - Serverless.yml or SAM template
   - README with deployment instructions

2. **Frontend:**
   - React app with all pages/components
   - Cognito integration
   - API integration with backend
   - Mobile-first responsive CSS
   - README with setup instructions

3. **Documentation:**
   - API documentation (endpoints, request/response formats)
   - Deployment guide
   - Environment variable setup guide

---

## SUCCESS CRITERIA

- User can sign up with email or Google
- User can create a team and become leader
- User can browse teams and request to join
- Team members can approve join requests
- Team leader can pay via Stripe
- Users in paid teams can access enigma content
- Users not in teams or in unpaid teams are blocked from content
- Everything works on mobile devices

---

## NOTES FOR CLAUDE CODE

- Use TypeScript if possible for type safety
- Add proper error handling and user-friendly error messages
- Log important events for debugging
- Use environment variables for all configuration
- Follow AWS best practices for Lambda/DynamoDB
- Keep functions small and single-purpose
- Add comments for complex business logic