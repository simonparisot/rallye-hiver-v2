# API Contract

**Last updated by**: backend agent
**Last updated**: 2026-09-12
**Base URL**: `https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod`

---

## Overview

This document is the **single source of truth** for all API endpoints in the Rallye d'Hiver application. Both frontend and backend agents must follow these contracts exactly.

### Authentication

All endpoints (except signup, login, refresh, and webhook) require JWT Bearer token:
```
Authorization: Bearer <accessToken>
```

Tokens are obtained from login and expire after 24 hours. Refresh tokens valid for 90 days.

### Response Format

**Success responses** wrap data in an object:
```json
{
  "message": "Success message",
  "data": { ... }
}
```

**Error responses** follow this format:
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
- `409` - Conflict
- `500` - Internal Server Error

---

## Game Status Endpoints

### GET /game/status

**Status**: ✅ Implemented (2025-12-02)
**Purpose**: Check if the Rallye d'Hiver game has started
**Authentication**: None required (public endpoint)

**Response** (200):
```json
{
  "isStarted": boolean,
  "startedAt": "ISO 8601 timestamp | null"
}
```

**Notes**:
- Public endpoint accessible without authentication
- Frontend should poll this endpoint or check it on app load
- If `isStarted: false`, frontend should display a waiting/countdown state
- If `isStarted: true`, frontend allows normal game interaction
- `startedAt` is null if game hasn't started yet

---

## Authentication Endpoints

### POST /auth/signup

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Create new user account
**Authentication**: None required

**Request**:
```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars, 1 uppercase, 1 lowercase, 1 number)",
  "displayName": "string (required)"
}
```

**Response** (200):
```json
{
  "message": "User created successfully",
  "user": {
    "userId": "uuid",
    "email": "string",
    "displayName": "string"
  }
}
```

**Errors**:
- `400`: Missing or invalid fields
- `409`: User already exists

### POST /auth/login

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Authenticate user and receive tokens
**Authentication**: None required

**Request**:
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response** (200):
```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)",
  "idToken": "string (JWT)",
  "user": {
    "userId": "uuid",
    "email": "string",
    "displayName": "string",
    "teamId": "string | null",
    "role": "'leader' | 'member' | null"
  }
}
```

**Errors**:
- `400`: Missing email or password
- `401`: Invalid credentials
- `404`: User not found

**Notes**:
- Store all three tokens in localStorage
- accessToken expires in 1 hour
- refreshToken expires in 30 days

### GET /auth/me

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Get current user information
**Authentication**: Required

**Response** (200):
```json
{
  "userId": "uuid",
  "email": "string",
  "displayName": "string",
  "teamId": "string | null",
  "role": "'leader' | 'member' | null"
}
```

**Errors**:
- `401`: Unauthorized (invalid token)
- `404`: User not found

### POST /auth/forgot-password

**Status**: ✅ Implemented (2025-11-23)
**Purpose**: Initiate password reset flow
**Authentication**: None required

**Request**:
```json
{
  "email": "string (required)"
}
```

**Response** (200):
```json
{
  "message": "Password reset code sent to your email"
}
```

**Errors**:
- `400`: Missing email or invalid email format
- `429`: Too many requests (rate limited)

**Notes**:
- Sends a 6-digit verification code to user's email
- Code expires after 24 hours
- For security, always returns success even if email doesn't exist
- User will receive email from AWS Cognito with reset code

### POST /auth/reset-password

**Status**: ✅ Implemented (2025-11-23)
**Purpose**: Complete password reset with verification code
**Authentication**: None required

**Request**:
```json
{
  "email": "string (required)",
  "code": "string (required, 6-digit verification code)",
  "newPassword": "string (required, min 8 chars, 1 uppercase, 1 lowercase, 1 number)"
}
```

**Response** (200):
```json
{
  "message": "Password reset successful. You can now login with your new password"
}
```

**Errors**:
- `400`: Missing required fields
- `400`: Invalid verification code (CodeMismatchException)
- `400`: Verification code expired (ExpiredCodeException)
- `400`: Password doesn't meet requirements (InvalidPasswordException)
- `404`: User not found
- `429`: Too many attempts (rate limited)

**Password Requirements**:

---

### POST /auth/refresh

**Status**: ✅ Implemented (2025-12-23)
**Purpose**: Refresh access token using refresh token
**Authentication**: None required

**Request**:
```json
{
  "refreshToken": "string (required)"
}
```

**Response** (200):
```json
{
  "accessToken": "string (JWT access token)",
  "idToken": "string (JWT ID token)",
  "expiresIn": number (seconds until expiration, typically 86400 for 24 hours)
}
```

**Errors**:
- `400`: Missing refresh token
- `401`: Invalid or expired refresh token
- `500`: Failed to refresh token

**Notes**:
- Use this endpoint when the access token expires (after 24 hours)
- The refresh token is valid for 90 days
- Frontend should automatically refresh tokens before expiration
- Store refresh token securely (httpOnly cookie recommended)

**Password Requirements**:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

---

## Team Endpoints

### POST /teams

**Status**: ✅ Implemented (2025-11-15, updated 2025-12-02)
**Purpose**: Create a new team
**Authentication**: Required

**Request**:
```json
{
  "teamName": "string (required)"
}
```

**Response** (200):
```json
{
  "message": "Team created successfully",
  "team": {
    "teamId": "uuid",
    "teamName": "string",
    "leaderId": "uuid",
    "members": [],
    "hasPaid": false
  }
}
```

**Errors**:
- `400`: Missing team name
- `409`: User already in a team
- `409`: A team with this name already exists (as of 2025-12-02)

**Notes**:
- Creator becomes team leader automatically
- User's teamId and role are updated to leader
- **As of 2025-12-02**: Team names must be unique across the application
- Team names are compared case-sensitively after trimming whitespace

### GET /teams

**Status**: ✅ Implemented (2025-11-15, updated 2025-12-12)
**Purpose**: List all teams for browsing
**Authentication**: Required
**Query Parameters**:
- `limit` (number, optional, default: 200): Maximum teams to return
- `nextToken` (string, optional): Pagination token for next page

**Response** (200):
```json
{
  "teams": [
    {
      "teamId": "uuid",
      "teamName": "string",
      "memberCount": number,
      "hasPaid": boolean
    }
  ],
  "nextToken": "string (optional, if more results available)"
}
```

**Notes**:
- Returns lightweight team list for browsing
- Does not include full member details
- **As of 2025-12-12**: Default limit increased from 50 to 200
- Supports pagination via `nextToken` if more than 200 teams exist

### GET /teams/{teamId}

**Status**: ✅ Implemented (2025-11-15)
**Purpose**: Get detailed team information
**Authentication**: Required

**Response** (200):
```json
{
  "teamId": "uuid",
  "teamName": "string",
  "leaderId": "uuid",
  "members": [
    {
      "userId": "uuid",
      "displayName": "string"
    }
  ],
  "hasPaid": boolean,
  "pendingRequests": [
    {
      "userId": "uuid",
      "displayName": "string"
    }
  ]
}
```

**Errors**:
- `404`: Team not found

**Notes**:
- `pendingRequests` only returned to team leader

### GET /teams/stats

**Status**: ✅ Implemented (documenté le 2026-09-12, à l'occasion de la pénalité d'indices)
**Purpose**: Statistiques de l'équipe de l'utilisateur connecté
**Authentication**: Required

**Response** (200):
```json
{
  "teamName": "string",
  "memberCount": number,
  "enigmasSolved": number,
  "totalEnigmas": number,
  "parcoursCompleted": number,
  "totalParcours": number,
  "totalPoints": number,
  "hintsRequestedCount": number,
  "passwordAttemptsCount": number,
  "attemptsRanking": number,
  "attemptsRankingMessage": "string"
}
```

**Notes**:
- `totalPoints` : somme des points des énigmes résolues. **Les indices n'en
  retirent rien pendant l'essai** : le commanditaire veut d'abord juger le
  mécanisme de choix, et facturer des points brouillerait cette question
- `hintsRequestedCount` : nombre total d'indices obtenus. C'est une mesure
  d'usage, sans effet sur le score

**Errors**:
- `403`: L'utilisateur n'appartient à aucune équipe
- `404`: Team not found

### POST /teams/{teamId}/join

**Status**: ✅ Implemented (2025-11-15)
**Purpose**: Request to join a team
**Authentication**: Required

**Response** (200):
```json
{
  "message": "Join request sent successfully"
}
```

**Errors**:
- `400`: User already in a team
- `404`: Team not found

### POST /teams/{teamId}/approve/{userId}

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Approve pending join request (leader only)
**Authentication**: Required (must be team leader)

**Response** (200):
```json
{
  "message": "User approved successfully"
}
```

**Errors**:
- `403`: Not team leader
- `404`: Team or user not found

**Notes**:
- Removes user from pendingRequests
- Adds user to team members
- Updates user's teamId and role

### POST /teams/{teamId}/reject/{userId}

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Reject pending join request (leader only)
**Authentication**: Required (must be team leader)

**Response** (200):
```json
{
  "message": "User rejected successfully"
}
```

**Errors**:
- `403`: Not team leader
- `404`: Team or user not found

### DELETE /teams/{teamId}/members/{userId}

**Status**: ✅ Implemented (2025-11-15)
**Purpose**: Remove member from team (leader only)
**Authentication**: Required (must be team leader)

**Response** (200):
```json
{
  "message": "Member removed successfully"
}
```

**Errors**:
- `403`: Not team leader or trying to remove self
- `404`: Team or user not found

**Notes**:
- Cannot remove team leader
- User's teamId and role are cleared

---

## Payment Endpoints

### POST /payments/create-checkout

**Status**: ✅ Implemented (2025-11-15, updated 2025-11-24)
**Purpose**: Create Stripe checkout session
**Authentication**: Required (must be team member)

**Request**:
```json
{
  "teamId": "uuid (required)"
}
```

**Response** (200):
```json
{
  "checkoutUrl": "string (Stripe checkout URL)"
}
```

**Errors**:
- `400`: Missing teamId
- `403`: Not a team member
- `404`: Team not found

**Notes**:
- **As of 2025-11-24**: Any team member can initiate payment (not just leader)
- Frontend should redirect to checkoutUrl
- Success URL: `{FRONTEND_URL}?payment=success`
- Cancel URL: `{FRONTEND_URL}?payment=cancelled`

### POST /payments/webhook

**Status**: ✅ Implemented (2025-11-15)
**Purpose**: Handle Stripe webhook events
**Authentication**: None (Stripe signature verification)

**Response** (200):
```json
{
  "received": true
}
```

**Errors**:
- `400`: Invalid signature or payload

**Supported Events**:
- `checkout.session.completed` - Marks team as paid

**Notes**:
- Called by Stripe, not frontend
- Updates team's `hasPaid` status
- Verified using `STRIPE_WEBHOOK_SECRET`

---

## Content Access Endpoints

### GET /content/check-access

**Status**: ✅ Implemented (2025-11-15)
**Purpose**: Check if user has access to premium content
**Authentication**: Required

**Response** (200):
```json
{
  "hasAccess": boolean,
  "reason": "string (optional, when hasAccess=false)"
}
```

**Possible Reasons**:
- `"No team"` - User not in a team
- `"Team hasn't paid"` - Team hasn't completed payment

**Notes**:
- Used before showing game content UI
- hasAccess=true means user can access enigmas

### GET /content/enigma

**Status**: ✅ Implemented (2025-11-15)
**Purpose**: Get enigma content (paid teams only)
**Authentication**: Required

**Response** (200):
```json
{
  "enigmaData": {
    "title": "string",
    "description": "string",
    "enigmas": [
      {
        "id": number,
        "title": "string",
        "content": "string",
        "hint": "string"
      }
    ]
  }
}
```

**Errors**:
- `403`: Access denied (no team or team hasn't paid)

---

## User Endpoints

### GET /users/pending-requests

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Get list of teams where user has pending join requests
**Authentication**: Required

**Response** (200):
```json
{
  "pendingRequests": [
    {
      "teamId": "uuid",
      "teamName": "string"
    }
  ]
}
```

**Notes**:
- Returns empty array if no pending requests

---

## Game Endpoints

### Enigma Endpoints

#### GET /enigmas

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: List all enigmas
**Authentication**: Required

**Response** (200):
```json
{
  "enigmas": [
    {
      "enigmaId": "uuid",
      "enigmaNumber": number,
      "title": "string",
      "description": "string",
      "pdfUrl": "string (S3 URL)",
      "points": number,
      "hintsCount": number,
      "difficulty": "'easy' | 'medium' | 'hard'",
      "isActive": boolean,
      "createdAt": "ISO 8601 timestamp",
      "updatedAt": "ISO 8601 timestamp"
    }
  ],
  "count": number
}
```

**Notes**:
- `correctPassword`, `solution` et `hints` ne sont JAMAIS exposés aux clients
- `hintsCount` : nombre d'indices pré-écrits existants. Le joueur en a besoin pour
  savoir s'il peut demander un indice ; le texte des indices reste côté serveur
- Returns all active enigmas

#### GET /enigmas/{enigmaId}

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Get detailed enigma information
**Authentication**: Required

**Response** (200):
```json
{
  "enigma": {
    "enigmaId": "uuid",
    "enigmaNumber": number,
    "title": "string",
    "description": "string",
    "pdfUrl": "string",
    "points": number,
    "hintsCount": number,
    "difficulty": "'easy' | 'medium' | 'hard'",
    "isActive": boolean,
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
  }
}
```

**Notes**:
- `correctPassword`, `solution` et `hints` ne sont JAMAIS exposés aux clients

**Errors**:
- `404`: Enigma not found

#### GET /enigmas/by-difficulty

**Status**: ✅ Implemented (2024-12-24, updated algorithm 2024-12-24)
**Purpose**: Get all enigmas sorted by calculated difficulty score (easiest first)
**Authentication**: Required
**Caching**: 24-hour aggressive cache - recalculation happens ~once per day on average

**Response** (200):
```json
{
  "enigmas": [
    {
      "enigmaId": "uuid",
      "enigmaNumber": number,
      "title": "string",
      "difficulty": number | null,  // 0-10 scale, null if not calculable
      "lastCalculated": "ISO 8601 timestamp"
    }
  ],
  "fromCache": boolean,
  "calculatedAt": "ISO 8601 timestamp"
}
```

**Difficulty Calculation** (updated 2024-12-24):
- Score from 0-10 based on team behavior
- Factors: attempt intensity, failure rate among active teams, resolution time from first attempt
- `null` if no attempts yet (not calculable)
- Sorted easiest first, nulls at end

**Frontend Implementation Notes**:
- Display difficulty as visual indicator (e.g., star rating, color gradient)
- Cache response client-side for at least 1 hour
- Show `lastCalculated` timestamp to users
- Handle `null` difficulty gracefully (e.g., "Not yet rated")

#### POST /enigmas (Admin Only)

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Create new enigma
**Authentication**: Required (admin only)

**Request**:
```json
{
  "enigmaNumber": number,
  "title": "string",
  "description": "string",
  "pdfUrl": "string (S3 URL)",
  "correctPassword": "string",
  "points": number,
  "difficulty": "'easy' | 'medium' | 'hard'",
  "isActive": boolean
}
```

**Response** (200):
```json
{
  "message": "Enigma created successfully",
  "enigma": { ... }
}
```

#### PUT /enigmas/{enigmaId} (Admin Only)

**Status**: ✅ Implemented (2025-11-16, updated 2025-11-29)
**Purpose**: Update enigma
**Authentication**: Required (admin only)

**Request** (all fields optional):
```json
{
  "title": "string",
  "description": "string",
  "pdfUrl": "string",
  "correctPassword": "string",
  "points": number,
  "difficulty": "'easy' | 'medium' | 'hard'",
  "isActive": boolean,
  "enigmaNumber": number
}
```

**Notes**:
- **As of 2025-11-29**: Added `enigmaNumber` field support for drag-and-drop reordering
- **As of 2025-11-29**: Fixed CORS configuration to support preflight OPTIONS requests

#### DELETE /enigmas/{enigmaId} (Admin Only)

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Delete enigma
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "message": "Enigma deleted successfully"
}
```

---

### Parcours Endpoints

#### GET /parcours

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: List all parcours
**Authentication**: Required

**Response** (200):
```json
{
  "parcours": [
    {
      "parcoursId": "uuid",
      "parcoursNumber": number,
      "title": "string",
      "description": "string",
      "pdfUrl": "string (S3 URL)",
      "requiredEnigmaIds": ["uuid", "uuid", ...],
      "requiredEnigmasCount": number,
      "isActive": boolean,
      "createdAt": "ISO 8601 timestamp",
      "updatedAt": "ISO 8601 timestamp"
    }
  ],
  "count": number
}
```

#### GET /parcours/{parcoursId}

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Get detailed parcours information
**Authentication**: Required

**Response** (200):
```json
{
  "parcours": {
    "parcoursId": "uuid",
    "parcoursNumber": number,
    "title": "string",
    "pdfUrl": "string",
    "requiredEnigmaIds": ["uuid", ...],
    "requiredEnigmasCount": number,
    "isActive": boolean
  }
}
```

**Errors**:
- `404`: Parcours not found

#### GET /parcours/{parcoursId}/access

**Status**: ✅ Implemented (2025-11-16, updated 2025-11-16)
**Purpose**: Check if team has access to parcours
**Authentication**: Required

**Response** (200) - Has Access:
```json
{
  "hasAccess": true,
  "unlockedAt": "ISO 8601 timestamp",
  "unlockedBy": []
}
```

**Response** (200) - No Access:
```json
{
  "hasAccess": false,
  "reason": "User is not in a team"
}
```

**Notes**:
- As of 2025-11-16: All parcours are accessible without conditions
- No enigmas need to be solved to access parcours
- Only requirement is being in a team

#### POST /parcours/{parcoursId}/complete

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: Mark a parcours as completed (frontend-initiated)
**Authentication**: Required

**Response** (200):
```json
{
  "message": "Parcours marked as completed",
  "parcoursId": "uuid",
  "completedAt": "ISO 8601 timestamp"
}
```

**Errors**:
- `400`: Missing parcoursId
- `403`: User must be in a team
- `404`: Parcours not found

**Notes**:
- This endpoint is called by the frontend when a user marks a parcours as complete
- Creates or updates the team's parcours access record with `completed: true`
- Can be called multiple times (idempotent)

#### POST /parcours (Admin Only)

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Create new parcours
**Authentication**: Required (admin only)

**Request**:
```json
{
  "parcoursNumber": number,
  "title": "string",
  "description": "string",
  "pdfUrl": "string (S3 URL)",
  "requiredEnigmaIds": ["uuid", ...],
  "requiredEnigmasCount": number,
  "isActive": boolean
}
```

---

### Progress Endpoints

#### POST /progress/attempt

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Submit password attempt for enigma
**Authentication**: Required

**Request**:
```json
{
  "enigmaId": "uuid",
  "password": "string"
}
```

**Response** (200) - Correct:
```json
{
  "success": true,
  "message": "Correct password! Enigma solved!",
  "attemptCount": number,
  "newlyUnlockedParcours": [
    {
      "parcoursId": "uuid",
      "title": "string",
      "parcoursNumber": number
    }
  ]
}
```

**Response** (200) - Incorrect:
```json
{
  "success": false,
  "message": "string (random funny message in French)",
  "attemptCount": number
}
```

**Example Error Messages** (randomly selected on each incorrect attempt):
- "Oups ! Ce n'est pas le bon code. Essayez encore !"
- "Presque ! Enfin... non, pas du tout en fait."
- "Raté ! Mais ne vous découragez pas !"
- "Hmm... Non. Retournez voir l'énigme !"
- "Incorrect ! Peut-être qu'une petite pause café vous aidera ?"
- "Nope ! Retour à l'énigme, détective !"
- _(20 different humorous messages total, selected randomly)_

**Response** (200) - Already Solved:
```json
{
  "success": false,
  "message": "Enigma already solved by your team",
  "alreadySolved": true
}
```

**Errors**:
- `400`: Missing required fields
- `403`: Team must pay to attempt enigmas
- `403`: User must be in a team
- `404`: Enigma not found

**Notes**:
- Passwords are matched case-insensitively
- All attempts are logged for admin review
- Team's `solvedEnigmasCount` increments on correct answer
- Parcours auto-unlock when requirements met (as of 2025-11-16, all parcours are unlocked by default)
- **As of 2025-11-16**: Points system removed - no points awarded or tracked

#### GET /progress

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Get team's enigma progress
**Authentication**: Required

**Response** (200):
```json
{
  "teamId": "uuid",
  "progress": [
    {
      "teamId": "uuid",
      "enigmaId": "uuid",
      "solved": boolean,
      "solvedAt": "ISO 8601 timestamp (if solved)",
      "attemptCount": number,
      "lastAttemptAt": "ISO 8601 timestamp",
      "firstAttemptAt": "ISO 8601 timestamp"
    }
  ],
  "totalSolved": number
}
```

**Errors**:
- `403`: User must be in a team

#### GET /progress/parcours

**Status**: ✅ Implemented (2025-11-16, updated 2025-11-22)
**Purpose**: Get team's accessible parcours with completion status
**Authentication**: Required

**Response** (200):
```json
{
  "teamId": "uuid",
  "accessibleParcours": [
    {
      "parcoursId": "uuid",
      "parcoursNumber": number,
      "title": "string",
      "pdfUrl": "string",
      "requiredEnigmaIds": ["uuid", ...],
      "unlockedAt": "ISO 8601 timestamp",
      "unlockedBy": [],
      "completed": boolean,
      "completedAt": "ISO 8601 timestamp | null"
    }
  ],
  "count": number
}
```

**Errors**:
- `403`: User must be in a team

**Notes**:
- As of 2025-11-16: Returns ALL active parcours
- No lock conditions - all parcours immediately accessible
- `unlockedBy` is always empty array
- **As of 2025-11-22**: Includes `completed` status set by frontend via `POST /parcours/{parcoursId}/complete`
- `completed` defaults to `false` if never marked
- `completedAt` is `null` until parcours is marked as complete

---

### Hint Endpoints

Récupération d'indices par les équipes. L'équipe décrit son avancement en texte
libre ; un modèle choisit, parmi les indices pré-écrits de l'énigme, celui qui
correspond le mieux à ce qu'elle décrit.

Le modèle ne rédige jamais rien qui atteigne le joueur : sa seule sortie possible
est un appel d'outil désignant l'identifiant d'un indice existant, et le texte
renvoyé est celui, pré-écrit, retrouvé par cet identifiant côté serveur. C'est ce
qui rend le prompt hacking sans objet.

#### GET /hints/{enigmaId}

**Status**: ✅ Implemented (2026-09-12)
**Purpose**: Demandes d'indice de l'équipe sur cette énigme, avec leur statut
**Authentication**: Required (équipe ayant réglé son inscription)

**Response** (200):
```json
{
  "enigmaId": "uuid",
  "hints": [
    {
      "id": "string",
      "text": "string",
      "requestedAt": "ISO 8601 timestamp",
      "pointsCharged": number
    }
  ],
  "requests": [
    {
      "requestId": "uuid",
      "status": "'pending' | 'done' | 'failed'",
      "requestedAt": "ISO 8601 timestamp",
      "pointsCharged": number,
      "hint": { "id": "string", "text": "string" },
      "failureReason": "string"
    }
  ],
  "hintsRequested": number,
  "remainingHints": number,
  "pendingRequest": boolean,
  "nextHintCost": number,
  "enigmaPoints": number,
  "totalPointsCharged": number
}
```

**Notes**:
- `hints` ne contient que les indices déjà livrés. Les indices non obtenus ne
  sortent jamais du backend, et une demande en attente ne porte aucun texte
- `requests` sert au suivi : c'est cet endpoint que le frontend interroge toutes
  les 3 secondes tant que `pendingRequest` est vrai
- `hint` n'est présent que sur une demande `done`, `failureReason` que sur une
  demande `failed`
- Le statut interne `processing` est replié sur `pending` : la distinction
  regarde le worker, pas l'équipe
- `nextHintCost` vaut 0 pendant l'essai (voir la note sur le coût plus bas)
- Aucun appel au modèle : cet endpoint est rapide et gratuit

**Errors**:
- `403`: L'utilisateur n'a pas d'équipe, ou l'équipe n'a pas réglé son inscription
- `404`: Enigma not found

#### POST /hints/{enigmaId}/request

**Status**: ✅ Implemented (2026-09-12)
**Purpose**: Demander un indice en décrivant son avancement
**Authentication**: Required (équipe ayant réglé son inscription)

**Request**:
```json
{
  "progress": "string (obligatoire, 20 à 3 000 caractères)",
  "requestKey": "string (optionnel, identifiant de la demande côté client)"
}
```

**Response** (200, mode `anthropic`) — l'indice est déjà là :
```json
{
  "requestId": "uuid",
  "status": "done",
  "hint": { "id": "string", "text": "string" },
  "pointsCharged": number,
  "hintsRequested": number,
  "remainingHints": number
}
```

**Response** (202, mode `queue`) — accusé de réception, l'indice viendra :
```json
{
  "requestId": "uuid",
  "status": "pending",
  "pointsCharged": number,
  "hintsRequested": number,
  "remainingHints": number
}
```

**Notes**:
- **Deux modes, un seul contrat.** `HINT_PROVIDER` vaut `anthropic` (la lambda
  appelle l'API Anthropic, réponse synchrone) ou `queue` (la lambda enregistre la
  demande, un worker extérieur l'exécute via `claude -p` et l'abonnement du
  commanditaire). Le client n'a pas à savoir lequel tourne : il lit `status`, et
  interroge `GET /hints/{enigmaId}` tant que c'est `pending`
- `progress` est du contenu écrit par les joueurs. Il est transmis au modèle
  entre balises, déclaré sans autorité, et n'est jamais interprété comme une
  instruction
- `requestKey` protège du double clic : deux envois portant la même clé pendant
  qu'une demande est en vol donnent un `409` au second
- **Coût nul pendant l'essai.** `pointsCharged` vaut 0 et aucun score n'est
  affecté : le commanditaire veut d'abord juger le mécanisme de choix. Le barème
  (25 % par indice, cumulatif) dort dans `backend/src/utils/hintCost.ts`, qui
  documente les deux gestes à faire pour le rebrancher

**Errors**:
- `400`: `progress` absent, de moins de 20 caractères, ou de plus de 3 000
- `403`: Pas d'équipe, équipe non payante, ou énigme inactive
- `404`: Énigme inconnue, ou énigme sans aucun indice pré-écrit
- `409`: Énigme déjà résolue, tous les indices déjà donnés, demande déjà en
  attente pour cette énigme, ou demande concurrente portant la même clé
- `502`: (mode `anthropic` seulement) l'appel au modèle a échoué. **Aucune
  demande n'est archivée** : l'équipe peut réessayer. En mode `queue`, un échec
  du worker se lit dans le statut `failed` de la demande, pas dans un code HTTP

---

### Admin Endpoints

#### Admin Authentication

##### POST /admin/auth/login

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: Admin login with enhanced verification
**Authentication**: None required

**Request**:
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response** (200):
```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)",
  "idToken": "string (JWT)",
  "user": {
    "userId": "uuid",
    "email": "string",
    "displayName": "string",
    "isAdmin": boolean
  }
}
```

**Errors**:
- `400`: Missing email or password
- `401`: Invalid credentials
- `403`: User is not an admin
- `404`: User not found

##### GET /admin/auth/verify

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: Verify admin authentication status
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "user": {
    "userId": "uuid",
    "email": "string",
    "displayName": "string",
    "isAdmin": boolean
  }
}
```

**Errors**:
- `401`: Unauthorized
- `403`: Admin access required
- `404`: User not found

##### POST /admin/auth/forgot-password

**Status**: ✅ Implemented (2025-11-23)
**Purpose**: Initiate password reset flow for admin users
**Authentication**: None required

**Request**:
```json
{
  "email": "string (required)"
}
```

**Response** (200):
```json
{
  "message": "Password reset code sent to your email"
}
```

**Errors**:
- `400`: Missing email or invalid email format
- `429`: Too many requests (rate limited)

**Notes**:
- Same flow as regular users, but intended for admin panel
- Admin status verified on login, not during password reset
- Sends 6-digit verification code to email

##### POST /admin/auth/reset-password

**Status**: ✅ Implemented (2025-11-23)
**Purpose**: Complete password reset for admin users
**Authentication**: None required

**Request**:
```json
{
  "email": "string (required)",
  "code": "string (required, 6-digit verification code)",
  "newPassword": "string (required, min 8 chars, 1 uppercase, 1 lowercase, 1 number)"
}
```

**Response** (200):
```json
{
  "message": "Password reset successful. You can now login with your new password"
}
```

**Errors**:
- `400`: Invalid verification code or password requirements not met
- `404`: User not found
- `429`: Too many attempts

---

##### POST /admin/auth/refresh

**Status**: ✅ Implemented (2025-12-23)
**Purpose**: Refresh admin access token using refresh token
**Authentication**: None required

**Request**:
```json
{
  "refreshToken": "string (required)"
}
```

**Response** (200):
```json
{
  "accessToken": "string (JWT access token)",
  "idToken": "string (JWT ID token)",
  "expiresIn": number (seconds until expiration, typically 86400 for 24 hours)
}
```

**Errors**:
- `400`: Missing refresh token
- `401`: Invalid or expired refresh token
- `500`: Failed to refresh token

**Notes**:
- Use this endpoint when the admin access token expires (after 24 hours)
- The refresh token is valid for 90 days
- Admin frontend should automatically refresh tokens before expiration

#### Admin Game Control

##### POST /admin/game/start

**Status**: ✅ Implemented (2025-12-02)
**Purpose**: Start the Rallye d'Hiver game (admin only)
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "message": "Game started successfully",
  "gameStatus": {
    "gameId": "rallye-2025",
    "isStarted": true,
    "startedAt": "ISO 8601 timestamp",
    "startedBy": "uuid (admin userId)",
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
  }
}
```

**Errors**:
- `400`: Game has already been started
- `401`: Authentication required
- `403`: Admin access required

**Notes**:
- Once started, the game **cannot** be stopped (`isStarted` cannot be reverted to `false`)
- If game status doesn't exist, it will be initialized automatically
- Only one admin needs to start the game for all users
- After starting, frontend clients will detect game is active via `GET /game/status`

#### Admin Statistics

##### GET /admin/stats/overview

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: Get aggregated statistics for admin dashboard
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "totalTeams": number,
  "totalPlayers": number,
  "totalEnigmas": number,
  "totalParcours": number,
  "teamsWithPayment": number,
  "totalAttempts": number,
  "successfulAttempts": number
}
```

**Errors**:
- `401`: Unauthorized
- `403`: Admin access required

---

##### GET /admin/stats/password-attempts-timeline

**Status**: ✅ Implemented (2026-01-02 - Updated to daily buckets)
**Purpose**: **Highly optimized** timeline of password attempts (correct and incorrect) grouped by day over the last 30 days
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "timeline": [
    {
      "day": "2025-12-03",
      "timestamp": "2025-12-03T00:00:00.000Z",
      "correctAttempts": 15,
      "incorrectAttempts": 42,
      "totalAttempts": 57,
      "successRate": 26.32
    },
    {
      "day": "2025-12-04",
      "timestamp": "2025-12-04T00:00:00.000Z",
      "correctAttempts": 23,
      "incorrectAttempts": 38,
      "totalAttempts": 61,
      "successRate": 37.70
    }
    // ... 30 days of data points
  ],
  "summary": {
    "totalAttempts": 1234,
    "correctAttempts": 234,
    "incorrectAttempts": 1000,
    "successRate": 18.96,
    "periodStart": "2025-12-03T00:00:00.000Z",
    "periodEnd": "2026-01-02T00:00:00.000Z",
    "daysIncluded": 30
  }
}
```

**Response Format**:
- `timeline`: Array of daily data points, sorted chronologically (oldest to newest)
  - `day`: Human-readable day bucket ("YYYY-MM-DD")
  - `timestamp`: ISO 8601 timestamp of the day start (midnight UTC)
  - `correctAttempts`: Number of correct password attempts on this day
  - `incorrectAttempts`: Number of incorrect password attempts on this day
  - `totalAttempts`: Total attempts on this day (correct + incorrect)
  - `successRate`: Daily success rate percentage (rounded to 2 decimals) - **NEW**
- `summary`: Aggregated statistics for the entire 30-day period
  - `totalAttempts`: Total password attempts in the period
  - `correctAttempts`: Total correct attempts
  - `incorrectAttempts`: Total incorrect attempts
  - `successRate`: Overall success rate percentage (rounded to 2 decimals)
  - `periodStart`: Start of the 30-day period (ISO 8601)
  - `periodEnd`: End of the 30-day period (ISO 8601)
  - `daysIncluded`: Number of day buckets in the timeline (always 30)

**Performance**:
- Single DynamoDB Scan with FilterExpression for time range
- Optimized for chart rendering (all 30 days included, even if count is 0)
- Typical response time: ~100-300ms

**Use Cases**:
- Admin dashboard long-term activity timeline chart (30-day view)
- Identifying peak activity hours
- Monitoring success/failure patterns
- Detecting suspicious activity spikes

**Errors**:
- `401`: Unauthorized
- `403`: Admin access required

---

#### Admin Teams Management

##### GET /admin/teams

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: List all teams with progress statistics
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "teams": [
    {
      "teamId": "uuid",
      "teamName": "string",
      "leaderId": "uuid",
      "members": [
        {
          "userId": "uuid",
          "displayName": "string",
          "email": "string",
          "role": "'leader' | 'member'"
        }
      ],
      "hasPaid": boolean,
      "solvedEnigmasCount": number,
      "unlockedParcoursCount": number,
      "totalAttempts": number,
      "lastActivityAt": "ISO 8601 timestamp"
    }
  ],
  "count": number
}
```

##### GET /admin/teams/progress-grid

**Status**: ✅ Implemented (2025-12-23)
**Purpose**: **Highly optimized** endpoint for admin progress grid - returns complete 20×68 enigma grid + 10×68 parcours grid in ONE request
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "teams": [
    {
      "teamId": "uuid",
      "teamName": "string",
      "hasPaid": boolean,
      "isBetaTeam": boolean,
      "memberCount": number,
      "lastActivityAt": "ISO 8601 timestamp | null",
      "enigmasProgress": [true, false, false, true, ...],
      "parcoursProgress": [false, true, false, ...],
      "solvedCount": number,
      "completedParcoursCount": number
    }
  ],
  "metadata": {
    "totalTeams": number,
    "enigmaIds": ["id1", "id2", ...],
    "enigmaTitles": ["Title 1", "Title 2", ...],
    "enigmaNumbers": [1, 2, 3, ...],
    "parcoursIds": ["id1", "id2", ...],
    "parcoursTitles": ["Title 1", "Title 2", ...],
    "parcoursNumbers": [1, 2, 3, ...]
  }
}
```

**Notes**:
- **CRITICAL PERFORMANCE**: Replaces 68+ individual API calls with **1 single aggregated request**
- `enigmasProgress`: Array of 20 booleans (one per enigma, in enigmaNumber order) - `true` = solved, `false` = not solved
- `parcoursProgress`: Array of 10 booleans (one per parcours, in parcoursNumber order) - `true` = completed, `false` = not completed
- `metadata.enigmaIds/enigmaTitles/enigmaNumbers`: Ordered arrays to map grid columns to enigmas
- `metadata.parcoursIds/parcoursTitles/parcoursNumbers`: Ordered arrays to map grid columns to parcours
- Teams are sorted alphabetically by `teamName` for consistent display
- All enigmas and parcours are sorted by their `enigmaNumber`/`parcoursNumber` fields
- Frontend can render grid directly: `teams[i].enigmasProgress[j]` = checkbox state for team i, enigma j

**Performance**:
- Before: 68 requests (1 per team) → ~5-10 seconds, frequent 500 errors
- After: 1 request → ~500ms, no errors
- **68x reduction in API calls**

**Use Case**:
- Admin progress grid dashboard showing 20 enigma columns + 10 parcours columns
- Each row = 1 team, each cell = checkbox (solved/completed or not)
- Replace existing implementation that calls `/admin/teams/{teamId}/progress` 68 times

##### GET /admin/users

**Status**: ✅ Implemented (2025-12-06)
**Purpose**: List all users without a team (including those with pending join requests)
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "users": [
    {
      "userId": "uuid",
      "email": "string",
      "displayName": "string",
      "hasPendingRequest": boolean,
      "pendingTeamName": "string | null",
      "createdAt": "ISO 8601 timestamp"
    }
  ],
  "count": number
}
```

**Notes**:
- Returns users who are not currently in any team
- Includes users with pending join requests to teams
- Users are sorted by creation date (newest first)
- `hasPendingRequest` is `true` if user has requested to join a team
- `pendingTeamName` contains the name of the team they requested to join, or `null`

##### GET /admin/users/all

**Status**: ✅ Implemented (2025-12-07)
**Purpose**: List ALL users with comprehensive information including team status and activity
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "users": [
    {
      "userId": "uuid",
      "email": "string",
      "displayName": "string",
      "createdAt": "ISO 8601 timestamp",
      "lastLoginAt": "ISO 8601 timestamp | null",
      "teamId": "uuid | null",
      "teamName": "string | null",
      "isTeamLeader": boolean,
      "teamStatus": "'no_team' | 'pending' | 'member'",
      "pendingTeamName": "string | null",
      "passwordAttemptsCount": number,
      "isAdmin": boolean
    }
  ],
  "count": number
}
```

**Notes**:
- Returns ALL users in the system (not just those without teams)
- Users are sorted by creation date (newest first)
- `teamStatus` indicates user's team relationship:
  - `no_team`: User has no team and no pending requests
  - `pending`: User has requested to join a team (see `pendingTeamName`)
  - `member`: User is a member of a team (see `teamName`)
- `isTeamLeader` is `true` if user is the leader of their team
- `passwordAttemptsCount` shows total number of enigma password attempts by this user
- `lastLoginAt` is currently `null` (login tracking to be implemented)
- `isAdmin` indicates if user has admin privileges

##### GET /admin/teams/{teamId}

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: Get detailed team information with statistics
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "team": {
    "teamId": "uuid",
    "teamName": "string",
    "leaderId": "uuid",
    "members": [...],
    "hasPaid": boolean,
    "solvedEnigmasCount": number,
    "unlockedParcoursCount": number,
    "totalAttempts": number,
    "lastActivityAt": "ISO 8601 timestamp"
  }
}
```

**Errors**:
- `400`: Missing teamId
- `404`: Team not found

##### GET /admin/teams/{teamId}/progress

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: Get detailed enigma progress for a team
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "progress": [
    {
      "teamId": "uuid",
      "enigmaId": "uuid",
      "enigmaTitle": "string",
      "enigmaNumber": number,
      "solved": boolean,
      "solvedAt": "ISO 8601 timestamp",
      "attemptCount": number,
      "lastAttemptAt": "ISO 8601 timestamp",
      "firstAttemptAt": "ISO 8601 timestamp"
    }
  ]
}
```

**Errors**:
- `400`: Missing teamId
- `404`: Team not found

#### Admin Enigmas Management

##### GET /admin/enigmas

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: List all enigmas with statistics
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "enigmas": [
    {
      "enigmaId": "uuid",
      "enigmaNumber": number,
      "title": "string",
      "description": "string",
      "pdfUrl": "string",
      "points": number,
      "difficulty": "'easy' | 'medium' | 'hard'",
      "isActive": boolean,
      "totalAttempts": number,
      "successfulAttempts": number,
      "teamsSolved": number
    }
  ],
  "count": number
}
```

##### GET /admin/enigmas/by-difficulty

**Status**: ✅ Implemented (2024-12-24, updated algorithm 2024-12-24)
**Purpose**: Get all enigmas sorted by calculated difficulty score with detailed metrics (admin view, easiest first)
**Authentication**: Required (admin only)
**Caching**: 24-hour aggressive cache - recalculation happens ~once per day on average

**Query Parameters**:
- `forceRefresh` (optional): Set to "true" to bypass cache and force recalculation

**Response** (200):
```json
{
  "enigmas": [
    {
      "enigmaId": "uuid",
      "enigmaNumber": number,
      "title": "string",
      "difficulty": number | null,  // 0-10 scale, null if not calculable
      "metrics": {
        "totalAttempts": number,
        "resolutions": number,
        "activeTeams": number,
        "totalTeams": number,
        "avgResolutionTimeDays": number | null,
        "intensityScore": number,      // 0-10: log₂(attempts/resolutions)
        "failureRateScore": number,    // 0-10: (1 - resolutions/activeTeams)
        "timeScore": number            // 0-10: time from first attempt
      },
      "lastCalculated": "ISO 8601 timestamp"
    }
  ],
  "fromCache": boolean,
  "calculatedAt": "ISO 8601 timestamp",
  "cacheTtlHours": 24
}
```

**Difficulty Algorithm** (updated 2024-12-24):
```
Difficulty = (0.3 × I) + (0.5 × E) + (0.2 × T)

Where:
- I (Intensity) = log₂(attempts / resolutions) - search effort
- E (Failure rate) = proportion of ACTIVE teams that haven't solved (not all teams)
- T (Time) = avg time from first attempt to resolution (not from rally start)
```

**Frontend Implementation Notes (Admin)**:
- Display full metrics breakdown for analysis
- Use `forceRefresh=true` sparingly (only when needed)
- Visualize the 3 component scores (I, E, T) separately
- Show which factor contributes most to difficulty
- Cache client-side for at least 1 hour
- Export data for offline analysis if needed

##### PUT /admin/enigmas/{enigmaId}

**Status**: ✅ Implemented (2025-11-29)
**Purpose**: Update enigma (admin-only endpoint with full CORS support)
**Authentication**: Required (admin only)

**Request** (all fields optional):
```json
{
  "title": "string",
  "description": "string",
  "pdfUrl": "string",
  "correctPassword": "string",
  "points": number,
  "difficulty": "'easy' | 'medium' | 'hard'",
  "isActive": boolean,
  "enigmaNumber": number
}
```

**Response** (200):
```json
{
  "message": "Enigma updated successfully",
  "enigma": {
    "enigmaId": "uuid",
    "enigmaNumber": number,
    "title": "string",
    ...
  }
}
```

**Errors**:
- `400`: Missing enigmaId parameter
- `401`: Authentication required
- `403`: Admin access required
- `404`: Enigma not found

**Notes**:
- **As of 2025-11-29**: Admin-specific endpoint with full CORS preflight support
- Used by admin panel for drag-and-drop reordering via `enigmaNumber` field
- CORS headers configured for `https://proto.rallyehiver.fr`

#### Admin Parcours Management

##### GET /admin/parcours

**Status**: ✅ Implemented (2025-11-22)
**Purpose**: List all parcours with statistics
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "parcours": [
    {
      "parcoursId": "uuid",
      "parcoursNumber": number,
      "title": "string",
      "description": "string",
      "pdfUrl": "string",
      "requiredEnigmaIds": ["uuid", ...],
      "requiredEnigmasCount": number,
      "isActive": boolean,
      "teamsUnlocked": number
    }
  ],
  "count": number
}
```

#### Admin Attempts Monitoring

##### GET /admin/attempts

**Status**: ✅ Implemented (2025-11-22, updated 2026-01-02)
**Purpose**: List all password attempts with filtering and global statistics
**Authentication**: Required (admin only)
**Query Parameters**:
- `success` (boolean, optional): Filter by success status
- `teamId` (uuid, optional): Filter by team
- `enigmaId` (uuid, optional): Filter by enigma
- `limit` (number, optional, default: 100): Results per page
- `offset` (number, optional, default: 0): Pagination offset

**Performance Note**: This endpoint now uses Query with DynamoDB indexes when `enigmaId` or `teamId` filters are provided (much more efficient than Scan). It also handles pagination correctly to return ALL matching attempts.

**Response** (200):
```json
{
  "attempts": [
    {
      "attemptId": "uuid",
      "teamId": "uuid",
      "teamName": "string",
      "enigmaId": "uuid",
      "enigmaTitle": "string",
      "password": "string",
      "success": boolean,
      "attemptedAt": "ISO 8601 timestamp",
      "attemptedBy": "uuid",
      "attemptedByName": "string"
    }
  ],
  "stats": {
    "totalAttempts": number,
    "totalSuccessful": number,
    "totalFailed": number,
    "activeTeams": number,
    "successRate": number
  }
}
```

**Response Fields**:
- `attempts`: Array of password attempt objects (paginated based on limit/offset query params)
- `stats`: Global statistics calculated on ALL matching attempts (not just the paginated page)

**Stats Field Description**:
- `totalAttempts`: Total number of attempts matching the filters
- `totalSuccessful`: Number of successful attempts (correct passwords)
- `totalFailed`: Number of failed attempts (incorrect passwords)
- `activeTeams`: Number of unique teams that attempted this enigma/filter
- `successRate`: Percentage of successful attempts (0-100, 2 decimal places)

**Frontend Usage**:
```typescript
// Example: Display stats for a specific enigma
const response = await fetch('/admin/attempts?enigmaId=xxx&limit=100&offset=0');
const data = await response.json();

// Use stats object for global statistics (NOT from paginated data!)
console.log(`${data.stats.totalSuccessful} successes out of ${data.stats.totalAttempts} attempts`);
console.log(`${data.stats.activeTeams} teams active on this enigma`);
console.log(`Success rate: ${data.stats.successRate}%`);

// Use attempts array for displaying paginated list
data.attempts.forEach(attempt => {
  console.log(`${attempt.teamName}: ${attempt.password} - ${attempt.success ? 'SUCCESS' : 'FAILED'}`);
});
```

##### GET /admin/hints/requests

**Status**: ✅ Implemented (2026-09-12)
**Purpose**: Journal des demandes d'indices, pour évaluer la fonctionnalité
**Authentication**: Required (Admin)

**Query parameters**:
| Paramètre | Défaut | Description |
|---|---|---|
| `enigmaId` | — | Ne garder que les demandes sur cette énigme |
| `teamId` | — | Ne garder que les demandes de cette équipe |
| `sort` | `desc` | `desc` (plus récentes d'abord) ou `asc` |
| `limit` | `50` | Taille de page, 1 à 200 |
| `cursor` | — | Curseur renvoyé par la réponse précédente |

**Response** (200):
```json
{
  "requests": [
    {
      "requestId": "uuid",
      "teamId": "uuid",
      "teamName": "string",
      "enigmaId": "uuid",
      "enigmaNumber": number,
      "enigmaTitle": "string",
      "requestedAt": "ISO 8601 timestamp",
      "requestedBy": "uuid (userId)",
      "progressText": "string (texte intégral écrit par l'équipe)",
      "status": "'pending' | 'processing' | 'done' | 'failed'",
      "hintId": "string",
      "hintText": "string (texte intégral de l'indice livré)",
      "justification": "string (note interne du modèle)",
      "failureReason": "string (renseignée quand status vaut failed)",
      "model": "string",
      "inputTokens": number,
      "outputTokens": number,
      "pointsCharged": number
    }
  ],
  "total": number,
  "limit": number,
  "cursor": "string | null",
  "stats": {
    "totalRequests": number,
    "uniqueTeams": number,
    "uniqueEnigmas": number,
    "totalPointsCharged": number
  }
}
```

**Notes**:
- Les équipes de test sont exclues, comme dans toutes les statistiques
- `total` porte sur la sélection filtrée ; `stats` porte sur l'ensemble du journal
- Les textes ne sont jamais tronqués : c'est l'objet même de cette page

**Errors**:
- `401`: Authentication required
- `403`: Admin access required

**Remplace** `GET /admin/hints/usage`, retiré avec l'ancien mécanisme de PDF d'indice.

#### POST /admin/upload/generate-url

**Status**: ✅ Implemented (2025-12-06)
**Purpose**: Generate presigned URL for PDF upload to S3
**Authentication**: Required (admin only)

**Request**:
```json
{
  "contentType": "application/pdf",
  "fileExtension": "pdf"
}
```

**Response** (200):
```json
{
  "uploadUrl": "string (presigned S3 URL valid for 15 minutes)",
  "fileUrl": "string (final public URL for the PDF)",
  "fileKey": "string (S3 key: 2025/{uuid}.pdf)",
  "expiresIn": 900,
  "message": "Upload the PDF using a PUT request to the uploadUrl"
}
```

**Errors**:
- `400`: Only PDF files are allowed
- `400`: File extension must be .pdf
- `401`: Authentication required
- `403`: Admin access required

**Notes**:
- Generates non-guessable filenames using UUID to prevent users from discovering unpublished enigmas/parcours
- Filename format: `2025/{random-uuid}.pdf` (e.g., `2025/a3f8c9d2-4e1b-4c7a-9f3e-5d2a1b4c6e8f.pdf`)
- Upload URL is valid for 15 minutes
- After receiving the response, admin frontend should upload the PDF file using a PUT request to `uploadUrl`
- The `fileUrl` should be stored in the enigma or parcours `pdfUrl` field
- S3 bucket: `rallyehiver-enigmas` (eu-west-1)

**Upload Flow**:
1. Admin calls `POST /admin/upload/generate-url` with content type
2. Backend generates presigned URL with unique filename
3. Admin frontend uploads PDF to S3 using presigned URL (PUT request)
4. Admin frontend stores `fileUrl` in enigma/parcours record

#### GET /admin/leaderboard

**Status**: ✅ Implemented (2025-11-16, updated 2025-11-22)
**Purpose**: Get global team rankings
**Authentication**: Required (admin only)

**Response** (200):
```json
{
  "leaderboard": [
    {
      "rank": number,
      "teamId": "uuid",
      "teamName": "string",
      "points": number,
      "solvedEnigmasCount": number,
      "memberCount": number,
      "lastActivityAt": "ISO 8601 timestamp"
    }
  ],
  "totalTeams": number
}
```

#### GET /admin/attempts/team/{teamId}

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Get password attempts by team
**Authentication**: Required (admin only)
**Query**: `?limit=100` (optional)

**Response** (200):
```json
{
  "teamId": "uuid",
  "attempts": [
    {
      "attemptId": "uuid",
      "teamId": "uuid",
      "enigmaId": "uuid",
      "password": "string",
      "success": boolean,
      "attemptedAt": "ISO 8601 timestamp",
      "attemptedBy": "uuid (userId)",
      "ipAddress": "string"
    }
  ],
  "count": number
}
```

#### GET /admin/attempts/enigma/{enigmaId}

**Status**: ✅ Implemented (2025-11-16)
**Purpose**: Get password attempts by enigma
**Authentication**: Required (admin only)
**Query**: `?limit=100` (optional)

**Response** (200):
```json
{
  "enigmaId": "uuid",
  "attempts": [
    {
      "attemptId": "uuid",
      "teamId": "uuid",
      "enigmaId": "uuid",
      "password": "string",
      "success": boolean,
      "attemptedAt": "ISO 8601 timestamp",
      "attemptedBy": "uuid (userId)",
      "ipAddress": "string"
    }
  ],
  "count": number
}
```

---

## Change Log

| Date | Endpoint | Change | Type | Impact |
|------|----------|--------|------|--------|
| 2026-09-12 | POST /hints/{enigmaId}/request, GET /hints/{enigmaId} | Mode `queue` : la demande part en attente (202) et un worker extérieur la traite via `claude -p`, faute de clé d'API pour l'essai. Ajout de `status` et `failureReason` aux demandes. Le coût en points passe à 0 et n'affecte plus `totalPoints` | Feature + Breaking | **Breaking** : `POST /hints/.../request` peut désormais répondre 202 sans indice ; le client doit lire `status` et interroger `GET /hints/{enigmaId}`. `hintsPenalty` disparaît de GET /teams/stats |
| 2026-09-12 | POST /hints/{enigmaId}/request, GET /hints/{enigmaId}, GET /admin/hints/requests | Nouvelle récupération d'indices : l'équipe décrit son avancement, un modèle choisit l'indice pré-écrit adapté. Remplace POST /hints/{enigmaId}/use et GET /admin/hints/usage, supprimés | Feature + Breaking | **Breaking** : les deux anciens endpoints n'existent plus ; `hintPdfUrl` et `hasHint` disparaissent de l'énigme au profit de `hintsCount`, `hintUsed`/`hintUsedAt` de la progression au profit de `hintsRequested`/`lastHintAt`. La pénalité de points, jusqu'ici annoncée mais jamais appliquée, est désormais déduite de `totalPoints` dans GET /teams/stats |
| 2026-01-02 | GET /admin/attempts | Fixed pagination bug (Scan → Query) + added stats object + removed legacy count/total fields | Bug Fix + Breaking | **Critical fix**: Now returns ALL attempts (not just 1MB), shows correct success counts; **Breaking**: Removed `count` and `total` root fields - use `stats.totalAttempts` instead; **Frontend must use stats object for all statistics** |
| 2024-12-24 | GET /enigmas/by-difficulty, GET /admin/enigmas/by-difficulty | Updated algorithm: removed A (abandonment), E now based on active teams only, T now from first attempt; sorting easiest→hardest; fixed enigma titles bug | Breaking | More accurate difficulty scores, better reflects actual challenge; **frontend must handle 3 metrics instead of 4** |
| 2024-12-24 | GET /enigmas/by-difficulty | Added difficulty-sorted enigmas list with 24h cache | Feature | Users can see enigmas ranked by actual difficulty (0-10 scale based on team behavior) |
| 2024-12-24 | GET /admin/enigmas/by-difficulty | Added difficulty analytics with full metrics breakdown | Feature | Admins can analyze enigma difficulty components and force refresh cache |
| 2025-12-23 | GET /admin/stats/password-attempts-timeline | Added optimized hourly password attempts timeline for last 48h | Feature | Admin can visualize activity patterns and success rates over time with chart-ready data |
| 2025-12-23 | GET /admin/teams/overview | Removed redundant endpoint (replaced by /admin/teams/progress-grid) | Cleanup | /progress-grid provides correct logic (completed vs hasAccess) and better data format for grids |
| 2025-12-12 | GET /teams | Increased default limit from 50 to 200 | Enhancement | Users can now browse all teams without pagination (55 teams currently registered) |
| 2025-12-07 | GET /admin/users/all | Added comprehensive user management endpoint with team status and activity metrics | Feature | Admin can view all users with full details including password attempts and team info |
| 2025-12-06 | POST /admin/upload/generate-url | Added PDF upload endpoint with presigned URLs | Feature | Secure PDF uploads with non-guessable filenames |
| 2025-12-06 | GET /admin/users | Added admin endpoint to list users without teams | Feature | Admin can see players who haven't joined any team |
| 2025-12-02 | POST /teams | Added unique team name validation | Enhancement | Prevents duplicate team names (409 error) |
| 2025-12-02 | GET /game/status | Added public endpoint to check if game has started | Feature | Frontend can display waiting state |
| 2025-12-02 | POST /admin/game/start | Added admin endpoint to start the game | Feature | Admin can control game start time |
| 2025-11-29 | PUT /admin/enigmas/{enigmaId} | Created admin-specific endpoint with CORS + enigmaNumber support | Feature | Admin drag-and-drop reordering now works |
| 2025-11-29 | PUT /enigmas/{enigmaId} | Fixed CORS preflight + added enigmaNumber field | Enhancement | Improved CORS support |
| 2025-11-24 | POST /payments/create-checkout | Any team member can now initiate payment (not just leader) | Enhancement | All team members can pay registration fees |
| 2025-11-24 | POST /auth/signup | Added password validation cleanup - orphaned users are deleted if password setting fails | Bug Fix | Prevents orphaned Cognito users |
| 2025-11-23 | POST /auth/forgot-password | Added forgot password endpoint for users | Feature | Users can reset forgotten passwords |
| 2025-12-23 | GET /admin/teams/progress-grid | Added highly optimized progress grid endpoint - 68 requests → 1 request | Feature | Critical performance improvement for admin grid (68x reduction in API calls) |
| 2025-12-23 | POST /auth/refresh | Added token refresh endpoint | Feature | Allows frontend to refresh expired access tokens |
| 2025-12-23 | POST /admin/auth/refresh | Added admin token refresh endpoint | Feature | Allows admin frontend to refresh expired access tokens |
| 2025-12-23 | Cognito token validity | Extended access/ID token validity to 24 hours, refresh token to 90 days | Enhancement | Reduced disconnection frequency |
| 2025-11-23 | POST /auth/reset-password | Added reset password endpoint for users | Feature | Complete password reset with verification code |
| 2025-11-23 | POST /admin/auth/forgot-password | Added forgot password endpoint for admins | Feature | Admins can reset forgotten passwords |
| 2025-11-23 | POST /admin/auth/reset-password | Added reset password endpoint for admins | Feature | Complete admin password reset |
| 2025-11-22 | POST /admin/auth/login | Added admin login with role verification | Feature | Admin panel authentication |
| 2025-11-22 | GET /admin/auth/verify | Added admin token verification | Feature | Admin session validation |
| 2025-11-22 | GET /admin/stats/overview | Added admin dashboard statistics | Feature | Admin overview |
| 2025-11-22 | GET /admin/teams | Added team listing with progress stats | Feature | Admin team management |
| 2025-11-22 | GET /admin/teams/{teamId} | Added detailed team view | Feature | Admin team details |
| 2025-11-22 | GET /admin/teams/{teamId}/progress | Added team progress tracking | Feature | Admin progress monitoring |
| 2025-11-22 | GET /admin/enigmas | Added enigmas list with stats | Feature | Admin enigma management |
| 2025-11-22 | GET /admin/parcours | Added parcours list with stats | Feature | Admin parcours management |
| 2025-11-22 | PUT /parcours/{parcoursId} | Added parcours update endpoint | Feature | Admin can modify parcours |
| 2025-11-22 | DELETE /parcours/{parcoursId} | Added parcours deletion endpoint | Feature | Admin can remove parcours |
| 2025-11-22 | GET /admin/attempts | Added attempts filtering with pagination | Feature | Admin attempts monitoring |
| 2025-11-22 | POST /enigmas, PUT /enigmas/{enigmaId}, DELETE /enigmas/{enigmaId} | Added admin role enforcement | Security | Only admins can modify enigmas |
| 2025-11-22 | POST /parcours | Added admin role enforcement | Security | Only admins can create parcours |
| 2025-11-22 | GET /admin/leaderboard, /admin/attempts/* | Added admin role enforcement | Security | Only admins can access admin data |
| 2025-11-22 | User model | Added isAdmin field to User interface | Schema | Supports admin role checks |
| 2025-11-22 | Users table | Added email-index GSI | Infrastructure | Enables admin login by email |
| 2025-11-22 | POST /parcours/{parcoursId}/complete | Added endpoint to mark parcours as completed | Feature | Frontend can track completion |
| 2025-11-22 | GET /progress/parcours | Now includes `completed` and `completedAt` fields | Enhancement | Frontend gets completion status |
| 2025-11-22 | POST /progress/attempt | Removed points system - no longer returns `points` or `totalTeamPoints` | Breaking | Frontend should not expect points fields |
| 2025-11-16 | GET /progress/parcours | All parcours now accessible without conditions | Breaking | Frontend can remove lock UI |
| 2025-11-16 | GET /parcours/{parcoursId}/access | Always returns `hasAccess: true` | Breaking | Frontend can remove lock checks |
| 2025-11-16 | POST /progress/attempt | Added random funny error messages (20 variants in French) | Enhancement | Better UX for incorrect attempts |
| 2025-11-16 | All game endpoints | Added enigma/parcours/progress APIs | Feature | New game functionality |
| 2025-11-16 | /auth/* | Removed Google OAuth | Breaking | OAuth no longer supported |
| 2025-11-16 | /teams/{teamId}/approve/{userId} | Added approval endpoint | Feature | New functionality |
| 2025-11-16 | /teams/{teamId}/reject/{userId} | Added rejection endpoint | Feature | New functionality |
| 2025-11-16 | /users/pending-requests | Added pending requests endpoint | Feature | New functionality |
| 2025-11-15 | All endpoints | Initial API deployment | - | - |

---

## Notes for Frontend

- All timestamps are ISO 8601 format
- All IDs are UUIDs (v4)
- Store accessToken, refreshToken, idToken in localStorage
- Include `Authorization: Bearer {accessToken}` header on all requests
- Team must have `hasPaid: true` to access game content
- Password attempts require team payment status
- Parcours auto-unlock when enigma requirements are met

### Performance & Caching Strategy

**Backend Caching (API Gateway):**
- `GET /enigmas` and `GET /parcours` are cached server-side for **5 minutes**
- Reduces response time from ~800ms (cold start) to <10ms when cached
- Cache automatically invalidates after 5 minutes

**Recommended Frontend Caching:**

For optimal performance, implement client-side caching for semi-static data:

```typescript
// Example: localStorage cache with TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedData(key: string) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp > CACHE_TTL) {
    localStorage.removeItem(key);
    return null;
  }

  return data;
}

function setCachedData(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
}

// Usage for enigmas
async function fetchEnigmas() {
  const cached = getCachedData('enigmas');
  if (cached) return cached;

  const response = await api.get('/enigmas');
  setCachedData('enigmas', response.data);
  return response.data;
}
```

**Endpoints recommended for frontend caching (5 min TTL):**
- `GET /enigmas` - Enigmas list (changes rarely)
- `GET /parcours` - Parcours list (changes rarely)
- `GET /game/status` - Game status (changes once at game start)

**Endpoints that should NOT be cached:**
- `GET /progress` - Team progress (changes frequently)
- `GET /teams/{teamId}` - Team details (membership changes)
- `POST /progress/attempt` - Password attempts (always fresh)
- Any mutation endpoints (POST, PUT, DELETE)

**Cache invalidation:**
- Clear `enigmas` cache when admin modifies enigmas
- Clear `parcours` cache when admin modifies parcours
- Clear on user logout
- Automatic expiration after 5 minutes
