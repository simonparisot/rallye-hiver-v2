# Decisions & Assumptions

**Last updated by**: both agents
**Last updated**: 2025-11-16

---

## Overview

This document records architectural decisions, trade-offs, and shared assumptions that affect both frontend and backend. All major decisions should be documented here with rationale and date.

---

## Authentication & Authorization

### JWT Token Strategy
**Decision**: Use AWS Cognito with JWT tokens
**Date**: 2025-11-15
**Rationale**:
- Native AWS integration reduces complexity
- Cognito handles token refresh automatically
- Industry-standard JWT format
- Three tokens: accessToken (1hr), refreshToken (30 days), idToken

**Implementation**:
- Frontend stores tokens in localStorage
- Backend validates JWT on every request (except public endpoints)
- `Authorization: Bearer {accessToken}` header required

**Trade-offs**:
- ✅ Secure and scalable
- ✅ No session management needed
- ❌ Tokens can't be revoked before expiration
- ❌ localStorage vulnerable to XSS (mitigated by Content Security Policy)

---

### Google OAuth Removal
**Decision**: Removed Google OAuth support
**Date**: 2025-11-16
**Rationale**:
- Simplified authentication flow
- Reduced dependency on external OAuth providers
- Email/password authentication sufficient for MVP

**Impact**:
- Frontend: Removed OAuth buttons and flow
- Backend: Removed OAuth endpoints
- Users: Must use email/password signup only

---

### Authorization Model
**Decision**: Role-based access control (leader vs member)
**Date**: 2025-11-15
**Rationale**:
- Simple two-tier permission model
- Team leader has exclusive rights (payment, approval, removal)
- Team members can approve join requests (democratic approach)

**Roles**:
- `leader`: Can pay, approve/reject requests, remove members
- `member`: Can approve join requests only
- `null`: User not in any team

---

## Payment Integration

### Payment Provider
**Decision**: Stripe Checkout (hosted payment page)
**Date**: 2025-11-15
**Rationale**:
- Stripe handles PCI compliance
- Hosted checkout reduces frontend complexity
- Webhook-based fulfillment is reliable
- One-time payment (not subscription)

**Flow**:
1. User clicks "Pay" → Frontend calls `POST /payments/create-checkout`
2. Backend creates Stripe session, returns URL
3. Frontend redirects to Stripe-hosted page
4. User completes payment on Stripe
5. Stripe webhook updates team `hasPaid` status
6. User redirected back to frontend

**Trade-offs**:
- ✅ Secure and PCI-compliant
- ✅ No credit card handling in our code
- ✅ Professional checkout experience
- ❌ Less UI customization control
- ❌ Requires webhook endpoint configuration

---

### Payment Amount
**Decision**: Store price server-side, not client-side
**Date**: 2025-11-15
**Rationale**:
- Security: Prevent price manipulation
- Single source of truth in backend environment variable
- Price ID from Stripe dashboard

**Implementation**:
- Frontend sends only `teamId`
- Backend looks up `STRIPE_PRICE_ID` from environment
- Amount defined in Stripe dashboard

---

## Database Design

### Database Choice
**Decision**: AWS DynamoDB with on-demand billing
**Date**: 2025-11-15
**Rationale**:
- Serverless-friendly (no connection pooling needed)
- Scales automatically with traffic
- Pay-per-request pricing (cost-effective for MVP)
- Native AWS integration

**Trade-offs**:
- ✅ No server management
- ✅ Infinite scalability
- ✅ Low cost for low traffic
- ❌ More complex query patterns than SQL
- ❌ No JOIN operations (denormalization required)

---

### Data Modeling Strategy
**Decision**: Single-table design for core entities, separate tables for game content
**Date**: 2025-11-16
**Rationale**:
- Users + Teams in separate tables (clear boundaries)
- Game content (Enigmas, Parcours) in separate tables (different access patterns)
- Progress tracking in dedicated tables (write-heavy, audit requirements)

**Tables**:
1. Users (GSI on cognitoSub)
2. Teams (no GSI needed)
3. Enigmas (GSI on enigmaNumber)
4. Parcours (GSI on parcoursNumber)
5. TeamEnigmaProgress (GSI on enigmaId)
6. TeamParcoursAccess (composite key)
7. PasswordAttemptsLog (3 GSIs for admin queries)

---

### Audit Logging
**Decision**: Log ALL password attempts in separate table
**Date**: 2025-11-16
**Rationale**:
- Security: Detect brute-force attempts
- Analytics: Understand team behavior
- Admin: Review attempt patterns per team/enigma
- Compliance: Complete audit trail

**Implementation**:
- Every password attempt writes to PasswordAttemptsLog table
- Never delete attempts (retained indefinitely)
- Multiple GSIs for efficient querying by team, enigma, or combination

**Trade-offs**:
- ✅ Complete audit trail
- ✅ Flexible admin queries
- ❌ Additional write cost per attempt
- ❌ Storage grows indefinitely (acceptable for game scale)

---

## Game Mechanics

### Password Matching
**Decision**: Case-insensitive password matching
**Date**: 2025-11-16
**Rationale**:
- User-friendly (avoids frustration with caps lock)
- Common in puzzle games
- Passwords are unique identifiers, not security credentials

**Implementation**:
- Normalize both stored and submitted passwords to uppercase before comparison
- Store original case in database (for admin review)

---

### Parcours Unlocking Logic
**Decision**: Auto-unlock when required enigmas are solved
**Date**: 2025-11-16
**Rationale**:
- Automatic progression feels rewarding
- No manual unlock step needed
- Clear requirements (solve X enigmas to unlock parcours)

**Implementation**:
- Each parcours has `requiredEnigmaIds` array and `requiredEnigmasCount`
- When enigma is solved, backend checks if any parcours should unlock
- Creates TeamParcoursAccess entry with `unlockedAt` timestamp
- Returns `newlyUnlockedParcours` array in password attempt response

**Example**:
- Parcours 1 requires enigmas [1, 2, 3] (requiredEnigmasCount: 3)
- Team solves enigma 3 → Backend checks: team has 1, 2, 3 solved → Unlock parcours 1

---

### Points System
**Decision**: Fixed points per enigma, no time bonuses
**Date**: 2025-11-16
**Rationale**:
- Simple and fair
- No pressure to rush (enjoy the game)
- Points based on difficulty (easy=10, medium=15, hard=20)

**Implementation**:
- Each enigma has `points` field
- When solved, add to team's total points
- Leaderboard sorts by total points

**Future Consideration**: Could add time bonuses in future seasons

---

## API Design

### RESTful Conventions
**Decision**: Follow REST conventions with resource-based URLs
**Date**: 2025-11-15
**Rationale**:
- Industry standard, familiar to developers
- Clear resource hierarchy
- HTTP verbs match operations (GET, POST, PUT, DELETE)

**Examples**:
- `GET /teams` - List teams
- `POST /teams` - Create team
- `GET /teams/{id}` - Get specific team
- `DELETE /teams/{id}/members/{userId}` - Remove member

---

### Error Response Format
**Decision**: Consistent JSON error format
**Date**: 2025-11-15
**Format**:
```json
{
  "error": "Human-readable error message"
}
```

**Rationale**:
- Simple and consistent
- Easy to display in frontend
- Clear error messages for debugging

**Status Codes**:
- 200: Success
- 400: Bad request (validation error)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not found
- 409: Conflict (duplicate resource)
- 500: Internal server error

---

### CORS Configuration
**Decision**: Allow frontend domain only
**Date**: 2025-11-15
**Configuration**:
- Development: `http://localhost:3000`
- Production: `https://proto.rallyehiver.fr`

**Rationale**:
- Security: Prevent unauthorized domain access
- Simple configuration for single frontend

---

## Frontend Architecture

### State Management
**Decision**: React Query (TanStack Query) for server state
**Date**: 2025-11-15
**Rationale**:
- Handles caching, loading, error states automatically
- Perfect for API-driven apps
- Reduces boilerplate vs Redux
- Built-in refetch and invalidation

**Implementation**:
- `useQuery` for data fetching (GET requests)
- `useMutation` for mutations (POST, PUT, DELETE)
- `queryClient.invalidateQueries` to refresh after mutations

**Trade-offs**:
- ✅ Less code to maintain
- ✅ Automatic caching and deduplication
- ✅ Loading/error states built-in
- ❌ Learning curve for team
- ❌ Less control than Redux

---

### Component Structure
**Decision**: Feature-based folder structure
**Date**: 2025-11-16
**Structure**:
```
src/
├── components/         # Shared components
│   ├── layout/
│   └── panels/         # Game-specific panels
├── pages/              # Route pages
├── services/           # API calls and business logic
├── contexts/           # React contexts (Auth)
└── types/              # TypeScript types
```

**Rationale**:
- Clear separation of concerns
- Easy to find related code
- Scales well as app grows

---

### Styling Strategy
**Decision**: Plain CSS with mobile-first approach
**Date**: 2025-11-15
**Rationale**:
- No dependency on CSS frameworks
- Full control over styling
- Smaller bundle size
- Mobile-first ensures good UX on all devices

**Trade-offs**:
- ✅ No framework lock-in
- ✅ Maximum flexibility
- ❌ More manual CSS writing
- ❌ No pre-built components

---

## Deployment

### Frontend Hosting
**Decision**: AWS S3 + CloudFront
**Date**: 2025-11-15
**Rationale**:
- Static site hosting (React build output)
- Global CDN for fast delivery
- HTTPS with custom domain
- Low cost

**Configuration**:
- S3 bucket: `proto.rallyehiver.fr`
- CloudFront distribution with SSL
- Route 53 for DNS

---

### Backend Hosting
**Decision**: AWS Lambda + API Gateway (Serverless)
**Date**: 2025-11-15
**Rationale**:
- Pay-per-invocation (cost-effective)
- Auto-scaling built-in
- No server management
- Fast cold starts with Node.js 20

**Framework**: Serverless Framework v4

**Trade-offs**:
- ✅ Zero server management
- ✅ Automatic scaling
- ✅ Cost-effective for variable traffic
- ❌ Cold starts (mitigated with provisioned concurrency if needed)
- ❌ 29-second timeout limit (not an issue for our use case)

---

### Environment Strategy
**Decision**: Two environments (dev and prod)
**Date**: 2025-11-15
**Environments**:
- `dev`: Development and testing (`-dev` suffix)
- `prod`: Production (`-prod` suffix)

**Deployment**:
- Backend: `serverless deploy --stage {env}`
- Frontend: `npm run build` + S3 sync

---

## Security Considerations

### Password Storage (Enigmas)
**Decision**: Store correct passwords in plain text in DynamoDB
**Date**: 2025-11-16
**Rationale**:
- Not user credentials (puzzle solutions)
- Need plain text for comparison
- DynamoDB encryption at rest provides base security
- Never exposed to clients via API

**Security**:
- DynamoDB encryption at rest (AWS managed keys)
- IAM permissions restrict access
- `correctPassword` field NEVER returned in API responses

---

### User Password Storage
**Decision**: Handled by AWS Cognito (bcrypt)
**Date**: 2025-11-15
**Rationale**:
- Cognito handles hashing/salting automatically
- Industry-standard security
- No password storage in our database

---

### Rate Limiting
**Decision**: API Gateway throttling (10 req/sec per IP)
**Date**: 2025-11-15
**Rationale**:
- Prevent brute-force password attempts
- Protect against DDoS
- Default API Gateway limits sufficient for MVP

**Future**: Consider per-team rate limiting for password attempts

---

## Testing Strategy

### Backend Testing
**Decision**: Functional tests for core flows
**Date**: 2025-11-16
**Implementation**:
- Tests in `/tests` directory
- Test auth, teams, payment webhooks
- Run with `./run-functional-tests.sh`

**Not Implemented** (low priority for MVP):
- Unit tests for individual functions
- Integration tests for DynamoDB operations

---

### Frontend Testing
**Decision**: Manual testing for MVP
**Date**: 2025-11-16
**Rationale**:
- Manual testing sufficient for small team
- Focus on features over test coverage initially
- TanStack Query provides some safety with type checking

**Future**: Add unit tests for complex components and E2E tests

---

## Monitoring & Logging

### Logging Strategy
**Decision**: CloudWatch Logs for all Lambda functions
**Date**: 2025-11-15
**Implementation**:
- Automatic logging for all Lambda invocations
- Log important events (password attempts, errors, payments)
- 7-day retention (default)

---

### Monitoring
**Decision**: CloudWatch metrics for basic monitoring
**Date**: 2025-11-15
**Metrics**:
- Lambda invocations, errors, duration
- API Gateway requests, latency, errors
- DynamoDB read/write capacity

**Future**: Consider adding custom business metrics (daily active teams, avg solve time, etc.)

---

## Assumptions

### User Behavior
- Teams typically have 2-5 members
- ~100 total teams for 2025 season
- ~20 enigmas, ~10 parcours per season
- Average 5-10 password attempts per enigma before solving
- Peak usage during weekends

### Business Logic
- One team per user (no switching teams)
- Payment is one-time, non-refundable
- All team members gain access when team pays
- Enigmas and parcours don't change during season
- Admin creates content manually via AWS console/scripts

### Future Considerations
- Multi-season support (add `gameId` field)
- Team chat feature (out of scope for MVP)
- Leaderboard with time-based rankings
- Hint system for stuck teams
- Email notifications

---

## Decision Log Summary

| Date | Decision | Category | Impact |
|------|----------|----------|--------|
| 2025-11-16 | Auto-unlock parcours | Game Mechanics | Frontend needs to show unlock notifications |
| 2025-11-16 | Log all password attempts | Security | Increased write costs, admin audit capability |
| 2025-11-16 | Case-insensitive passwords | UX | Simplified user experience |
| 2025-11-16 | Remove Google OAuth | Auth | Simplified authentication flow |
| 2025-11-16 | TanStack Query for state | Frontend | Reduced boilerplate, better caching |
| 2025-11-15 | DynamoDB on-demand | Database | Serverless architecture, pay-per-use |
| 2025-11-15 | Stripe Checkout | Payment | PCI compliance, professional UX |
| 2025-11-15 | AWS Cognito JWT | Auth | Industry-standard, scalable |
| 2025-11-15 | Serverless Framework | Infrastructure | Easy deployment, no server management |
| 2025-11-15 | S3 + CloudFront | Hosting | Fast global delivery, low cost |

---

## Notes

- All decisions documented here are considered **final for MVP**
- Future seasons may revisit some decisions based on learnings
- Breaking changes should be announced in COORDINATION-LOG.md
- Both agents should review this file before making architectural changes
