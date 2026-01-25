# Frontend Integration Guide
## Rallye d'Hiver v2 Backend

**Last Updated**: November 16, 2025
**Environment**: Development
**Status**: ✅ Deployed and Ready

---

## 🔗 API Information

### Base URL
```
https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev/dev
```

### Authentication
All endpoints (except signup/login/webhook) require a JWT Bearer token:
```
Authorization: Bearer <jwt_token>
```

---

## 📚 API Documentation Location

**Primary Source**: `/API_CONTRACT.md` at root level - Complete API specification

**Legacy Location**: `/api-contract/` directory (individual endpoint files - now archived)

All API contracts are consolidated in the main `API_CONTRACT.md` file. This is the single source of truth for all endpoints.

---

## 🎮 New Game Features

The backend now supports the complete game mechanics:

### Enigmas (~20 per game)
- List all enigmas: `GET /enigmas`
- Get enigma details: `GET /enigmas/{id}`
- View enigma PDF and attempt to solve
- Submit password: `POST /progress/attempt`

### Parcours (~10 per game)
- List all parcours: `GET /parcours`
- Get accessible parcours: `GET /progress/parcours`
- Parcours unlock automatically when required enigmas are solved

### Progress Tracking
- View team progress: `GET /progress`
- Real-time points and leaderboard: `GET /admin/leaderboard`
- All password attempts are logged for admin review

---

## 🗄️ Database Schema

**Primary Source**: `/DATA_MODELS.md` at root level - Complete data model specification

**Backend Details**: `/backend/DYNAMODB_SCHEMA.md` (backend-specific implementation)

**New Tables**:
1. Enigmas - Game puzzles with PDFs and passwords
2. Parcours - Multi-page PDFs unlocked by solving enigmas
3. TeamEnigmaProgress - Tracks which enigmas each team has solved
4. PasswordAttemptsLog - Complete audit log of all password attempts
5. TeamParcoursAccess - Tracks which parcours teams have unlocked

**Updated Team Model**:
```typescript
{
  // ... existing fields
  points: number;              // Total points earned
  solvedEnigmasCount: number;  // Number of enigmas solved
  lastActivityAt: string;      // Last password attempt timestamp
}
```

---

## 🔑 Environment Variables Needed

### For Backend (Already Configured)
```bash
COGNITO_USER_POOL_ID=<from-aws>
COGNITO_CLIENT_ID=<from-aws>
STRIPE_SECRET_KEY=<from-stripe>
STRIPE_WEBHOOK_SECRET=<from-stripe>
```

### For Frontend
```bash
REACT_APP_API_BASE_URL=https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev/dev
REACT_APP_COGNITO_USER_POOL_ID=<get-from-backend-team>
REACT_APP_COGNITO_CLIENT_ID=<get-from-backend-team>
REACT_APP_STRIPE_PUBLIC_KEY=<from-stripe>
```

To get Cognito values, ask backend team to run:
```bash
aws cloudformation describe-stacks --stack-name rallye-hiver-backend-dev --query 'Stacks[0].Outputs' --profile claude-admin
```

---

## 📋 Complete Endpoint List

### Authentication (3 endpoints)
- `POST /auth/signup` - Create account
- `POST /auth/login` - Get JWT token
- `GET /auth/me` - Get current user info

### Teams (7 endpoints)
- `POST /teams` - Create team
- `GET /teams` - List all teams
- `GET /teams/{teamId}` - Get team details
- `POST /teams/{teamId}/join` - Request to join
- `POST /teams/{teamId}/approve/{userId}` - Approve member
- `POST /teams/{teamId}/reject/{userId}` - Reject request
- `DELETE /teams/{teamId}/members/{userId}` - Remove member

### Payments (2 endpoints)
- `POST /payments/create-checkout` - Create Stripe session
- `POST /payments/webhook` - Stripe webhook (internal)

### Content (2 endpoints)
- `GET /content/check-access` - Verify payment status
- `GET /content/enigma` - Get enigma content

### Users (1 endpoint)
- `GET /users/pending-requests` - Get pending team requests

### Enigmas (5 endpoints)
- `POST /enigmas` - Create enigma (admin)
- `GET /enigmas` - List all enigmas
- `GET /enigmas/{id}` - Get enigma details
- `PUT /enigmas/{id}` - Update enigma (admin)
- `DELETE /enigmas/{id}` - Delete enigma (admin)

### Parcours (4 endpoints)
- `POST /parcours` - Create parcours (admin)
- `GET /parcours` - List all parcours
- `GET /parcours/{id}` - Get parcours details
- `GET /parcours/{id}/access` - Check if team has access

### Progress (3 endpoints)
- `POST /progress/attempt` - **Submit password attempt** ⭐ Core mechanic
- `GET /progress` - Get team's enigma progress
- `GET /progress/parcours` - Get team's accessible parcours

### Admin (3 endpoints)
- `GET /admin/leaderboard` - Global team rankings
- `GET /admin/attempts/team/{teamId}` - View team's attempts
- `GET /admin/attempts/enigma/{enigmaId}` - View enigma attempts

**Total**: 30 endpoints

---

## 🎯 Key Game Flow

1. **User signs up** → Creates account
2. **User creates/joins team** → Becomes member
3. **Team leader pays** → Team gets `hasPaid: true`
4. **Users view enigmas** → GET `/enigmas`
5. **Users attempt passwords** → POST `/progress/attempt`
   - ✅ Correct: Team earns points, enigma marked solved
   - ❌ Incorrect: Attempt logged, team can try again
6. **Parcours auto-unlock** → When required enigmas are solved
7. **Users view accessible parcours** → GET `/progress/parcours`
8. **Leaderboard updates** → Real-time team rankings

---

## 🔒 Access Control Rules

1. **All endpoints** (except signup/login/webhook) require authentication
2. **Password attempts** require:
   - User must be in a team
   - Team must have paid
3. **Admin endpoints** require admin role (TODO: implement role check)
4. **Team leader actions** (payment, remove members) require leader role
5. **Password matching** is case-insensitive

---

## 📊 Response Formats

### Success Response
```json
{
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error message description"
}
```

### Status Codes
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🧪 Testing the API

### Example: Submit Password Attempt
```bash
curl -X POST https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev/dev/progress/attempt \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enigmaId": "uuid-here",
    "password": "PARIS1889"
  }'
```

### Example: Get Team Progress
```bash
curl https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev/dev/progress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📁 TypeScript Types

Full type definitions: `/backend/src/types/index.ts`

You can copy these types to your frontend for type safety:

```typescript
// Game Content
interface Enigma {
  enigmaId: string;
  enigmaNumber: number;
  title: string;
  description?: string;
  pdfUrl: string;
  points: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Parcours {
  parcoursId: string;
  parcoursNumber: number;
  title: string;
  description?: string;
  pdfUrl: string;
  requiredEnigmaIds: string[];
  requiredEnigmasCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TeamEnigmaProgress {
  teamId: string;
  enigmaId: string;
  solved: boolean;
  solvedAt?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  firstAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Team {
  teamId: string;
  teamName: string;
  leaderId: string;
  hasPaid: boolean;
  members: string[];
  pendingRequests: string[];
  points?: number;              // NEW
  solvedEnigmasCount?: number;  // NEW
  lastActivityAt?: string;      // NEW
  createdAt: string;
  paidAt: string | null;
}
```

---

## 🆘 Support & Questions

For backend questions:
1. **Check API contracts**: `/API_CONTRACT.md` (single source of truth)
2. **Check data models**: `/DATA_MODELS.md` (database schemas)
3. **Check frontend requirements**: `/FRONTEND_REQUIREMENTS.md` (add questions here)
4. **Check decisions**: `/DECISIONS.md` (architectural choices)
5. **Check coordination log**: `/COORDINATION-LOG.md` (current status)
6. **Check this guide**: `/FRONTEND_INTEGRATION_GUIDE.md` (integration how-to)

For issues or clarifications:
- Add to `FRONTEND_REQUIREMENTS.md` (Questions section)
- Post in `COORDINATION-LOG.md` (Quick Communication section)
- Include: Endpoint URL, request payload, expected vs actual response, error messages

---

## ✅ Deployment Status

- **Environment**: Development (`dev`)
- **Region**: `eu-west-1`
- **Stack**: `rallye-hiver-backend-dev`
- **Lambda Functions**: 30 deployed
- **DynamoDB Tables**: 7 created
- **API Gateway**: Configured with CORS
- **Cognito**: User pool created
- **Status**: ✅ All systems operational

Last deployed: November 16, 2025
