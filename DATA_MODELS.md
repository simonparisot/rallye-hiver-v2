# Data Models

**Last updated by**: backend agent
**Last updated**: 2025-12-02

---

## Overview

This document defines all database schemas, entity relationships, and type definitions used throughout the Rallye d'Hiver application. All data is stored in AWS DynamoDB with on-demand billing.

---

## Core Entities

### User
**Table**: `rallye-hiver-backend-users-{stage}`
**Primary Key**: `userId` (UUID)
**GSI**: `cognitoSub-index` on `cognitoSub`

```typescript
interface User {
  userId: string;              // UUID, primary key
  cognitoSub: string;          // Cognito user identifier (indexed)
  email: string;               // User email
  displayName: string;         // Display name
  teamId: string | null;       // Team membership (null if not in team)
  role: 'leader' | 'member' | null;  // Team role
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
}
```

**Example**:
```json
{
  "userId": "u123e4567-e89b-12d3-a456-426614174000",
  "cognitoSub": "abc123...",
  "email": "user@example.com",
  "displayName": "Jean Dupont",
  "teamId": "t123e4567-e89b-12d3-a456-426614174002",
  "role": "member",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-20T14:35:22Z"
}
```

---

### Team
**Table**: `rallye-hiver-backend-teams-{stage}`
**Primary Key**: `teamId` (UUID)

```typescript
interface Team {
  teamId: string;              // UUID, primary key
  teamName: string;            // Team name
  leaderId: string;            // User ID of team leader
  hasPaid: boolean;            // Payment status
  stripePaymentId: string | null;  // Stripe payment reference
  members: string[];           // Array of user IDs
  pendingRequests: string[];   // Array of user IDs requesting to join
  points: number;              // Total points earned (default: 0)
  solvedEnigmasCount: number;  // Count of solved enigmas (default: 0)
  lastActivityAt: string | null;   // Last password attempt timestamp
  createdAt: string;           // ISO 8601 timestamp
  paidAt: string | null;       // ISO 8601 timestamp when payment completed
}
```

**Example**:
```json
{
  "teamId": "t123e4567-e89b-12d3-a456-426614174002",
  "teamName": "Les Champions",
  "leaderId": "u123e4567-e89b-12d3-a456-426614174000",
  "hasPaid": true,
  "stripePaymentId": "pi_123456789",
  "members": ["u123e4567-...", "u234e5678-...", "u345e6789-..."],
  "pendingRequests": ["u456e7890-..."],
  "points": 150,
  "solvedEnigmasCount": 15,
  "lastActivityAt": "2025-01-20T15:30:00Z",
  "createdAt": "2025-01-15T10:00:00Z",
  "paidAt": "2025-01-16T12:00:00Z"
}
```

---

## Game Content

### Enigma
**Table**: `rallye-hiver-backend-enigmas-{stage}`
**Primary Key**: `enigmaId` (UUID)
**GSI**: `enigmaNumber-index` on `enigmaNumber`

```typescript
interface Enigma {
  enigmaId: string;            // UUID, primary key
  enigmaNumber: number;        // Sequential identifier (1-20)
  title: string;               // Enigma title/name
  description?: string;        // Short description
  pdfUrl: string;              // S3 URL to enigma PDF
  correctPassword: string;     // Solution (NOT exposed to clients)
  points: number;              // Points awarded when solved
  difficulty?: 'easy' | 'medium' | 'hard';  // Difficulty level
  isActive: boolean;           // Whether enigma is active (default: true)
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
  gameId?: string;             // For multi-season support
}
```

**Example**:
```json
{
  "enigmaId": "e123e4567-e89b-12d3-a456-426614174000",
  "enigmaNumber": 1,
  "title": "Le Mystère de la Tour",
  "description": "Trouvez le code caché dans le plan",
  "pdfUrl": "https://s3.amazonaws.com/rallye-hiver-enigmas/2025/enigma-01.pdf",
  "correctPassword": "PARIS1889",
  "points": 10,
  "difficulty": "easy",
  "isActive": true,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

**Security Note**: `correctPassword` is NEVER returned to clients via API

---

### Parcours
**Table**: `rallye-hiver-backend-parcours-{stage}`
**Primary Key**: `parcoursId` (UUID)
**GSI**: `parcoursNumber-index` on `parcoursNumber`

```typescript
interface Parcours {
  parcoursId: string;          // UUID, primary key
  parcoursNumber: number;      // Sequential identifier (1-10)
  title: string;               // Parcours title/name
  description?: string;        // Short description
  pdfUrl: string;              // S3 URL to parcours PDF
  requiredEnigmaIds: string[]; // Array of enigma IDs that unlock this
  requiredEnigmasCount: number;    // How many required enigmas must be solved
  isActive: boolean;           // Whether parcours is active (default: true)
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
  gameId?: string;             // For multi-season support
}
```

**Example**:
```json
{
  "parcoursId": "p123e4567-e89b-12d3-a456-426614174001",
  "parcoursNumber": 1,
  "title": "Le Circuit des Monuments",
  "description": "Découvrez les secrets architecturaux",
  "pdfUrl": "https://s3.amazonaws.com/rallye-hiver-parcours/2025/parcours-01.pdf",
  "requiredEnigmaIds": ["e123e4567-...", "e234e5678-...", "e345e6789-..."],
  "requiredEnigmasCount": 3,
  "isActive": true,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

**Unlock Logic**: Parcours unlocks when team has solved `requiredEnigmasCount` of the enigmas in `requiredEnigmaIds`

---

## Progress Tracking

### TeamEnigmaProgress
**Table**: `rallye-hiver-backend-team-enigma-progress-{stage}`
**Primary Key**: `teamId` (String)
**Sort Key**: `enigmaId` (String)
**GSI**: `enigmaId-solvedAt-index` on `enigmaId` + `solvedAt`

```typescript
interface TeamEnigmaProgress {
  teamId: string;              // Team identifier (PK)
  enigmaId: string;            // Enigma identifier (SK)
  solved: boolean;             // Whether enigma is solved
  solvedAt?: string;           // ISO 8601 timestamp when solved
  attemptCount: number;        // Total number of attempts (default: 0)
  lastAttemptAt?: string;      // ISO 8601 timestamp of last attempt
  firstAttemptAt?: string;     // ISO 8601 timestamp of first attempt
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
}
```

**Example**:
```json
{
  "teamId": "t123e4567-e89b-12d3-a456-426614174002",
  "enigmaId": "e123e4567-e89b-12d3-a456-426614174000",
  "solved": true,
  "solvedAt": "2025-01-20T14:35:22Z",
  "attemptCount": 5,
  "lastAttemptAt": "2025-01-20T14:35:22Z",
  "firstAttemptAt": "2025-01-20T13:15:10Z",
  "createdAt": "2025-01-20T13:15:10Z",
  "updatedAt": "2025-01-20T14:35:22Z"
}
```

**Access Patterns**:
- Get team progress: Query by `teamId`
- Get enigma leaderboard: Query on GSI by `enigmaId`, sort by `solvedAt`

---

### TeamParcoursAccess
**Table**: `rallye-hiver-backend-team-parcours-access-{stage}`
**Primary Key**: `teamId` (String)
**Sort Key**: `parcoursId` (String)

```typescript
interface TeamParcoursAccess {
  teamId: string;              // Team identifier (PK)
  parcoursId: string;          // Parcours identifier (SK)
  hasAccess: boolean;          // Whether team has unlocked (default: true)
  unlockedAt: string;          // ISO 8601 timestamp when unlocked
  unlockedBy: string[];        // Array of enigma IDs that triggered unlock
  createdAt: string;           // ISO 8601 timestamp
}
```

**Example**:
```json
{
  "teamId": "t123e4567-e89b-12d3-a456-426614174002",
  "parcoursId": "p123e4567-e89b-12d3-a456-426614174001",
  "hasAccess": true,
  "unlockedAt": "2025-01-20T14:35:22Z",
  "unlockedBy": ["e123e4567-...", "e234e5678-...", "e345e6789-..."],
  "createdAt": "2025-01-20T14:35:22Z"
}
```

**Access Patterns**:
- Get accessible parcours for team: Query by `teamId`
- Check specific parcours access: GetItem with `teamId` + `parcoursId`

---

## Admin Audit Logs

### PasswordAttemptLog
**Table**: `rallye-hiver-backend-password-attempts-{stage}`
**Primary Key**: `attemptId` (UUID)
**GSIs**:
- `teamId-attemptedAt-index`: PK=`teamId`, SK=`attemptedAt`
- `enigmaId-attemptedAt-index`: PK=`enigmaId`, SK=`attemptedAt`
- `teamEnigma-index`: PK=`teamEnigmaKey`, SK=`attemptedAt`

```typescript
interface PasswordAttemptLog {
  attemptId: string;           // UUID, primary key
  teamId: string;              // Team identifier (indexed)
  enigmaId: string;            // Enigma identifier (indexed)
  teamEnigmaKey: string;       // Composite: "{teamId}#{enigmaId}" (indexed)
  password: string;            // Password that was attempted
  success: boolean;            // Whether password was correct
  attemptedAt: string;         // ISO 8601 timestamp (sort key for GSIs)
  attemptedBy?: string;        // User ID who made the attempt
  ipAddress?: string;          // IP address for security tracking
}
```

**Example**:
```json
{
  "attemptId": "a123e4567-e89b-12d3-a456-426614174003",
  "teamId": "t123e4567-e89b-12d3-a456-426614174002",
  "enigmaId": "e123e4567-e89b-12d3-a456-426614174000",
  "teamEnigmaKey": "t123e4567-e89b-12d3-a456-426614174002#e123e4567-e89b-12d3-a456-426614174000",
  "password": "PARIS1888",
  "success": false,
  "attemptedAt": "2025-01-20T13:15:10Z",
  "attemptedBy": "u123e4567-e89b-12d3-a456-426614174004",
  "ipAddress": "192.168.1.100"
}
```

**Access Patterns** (Admin only):
- All attempts by team: Query on `teamId-attemptedAt-index`
- All attempts for enigma: Query on `enigmaId-attemptedAt-index`
- Attempts for team+enigma: Query on `teamEnigma-index`

**Purpose**: Complete audit log of all password attempts for admin review and analytics

---

## Game Control

### GameStatus
**Table**: `rallye-hiver-backend-game-status`
**Primary Key**: `gameId` (String) - Fixed value: `"rallye-2025"`

```typescript
interface GameStatus {
  gameId: string;              // Fixed ID: "rallye-2025" (PK)
  isStarted: boolean;          // Whether the game has been started by admin
  startedAt?: string;          // ISO 8601 timestamp when game was started
  startedBy?: string;          // Admin userId who started the game
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
}
```

**Example**:
```json
{
  "gameId": "rallye-2025",
  "isStarted": false,
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedAt": "2025-12-01T10:00:00Z"
}
```

**Example (after started)**:
```json
{
  "gameId": "rallye-2025",
  "isStarted": true,
  "startedAt": "2025-12-02T09:00:00Z",
  "startedBy": "u123e4567-e89b-12d3-a456-426614174000",
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedAt": "2025-12-02T09:00:00Z"
}
```

**Access Patterns**:
- Get game status: GetItem with `gameId: "rallye-2025"`
- Start game: UpdateItem with condition `isStarted = false`

**Purpose**: Global flag to control when the Rallye d'Hiver game becomes accessible to players. Admin initiates game start.

---

## Entity Relationships

```
User ──┬─── (1:1) Team (via teamId)
       │
       └─── (N:1) Team (via Team.members[])

Team ──┬─── (1:N) TeamEnigmaProgress
       │
       ├─── (1:N) TeamParcoursAccess
       │
       ├─── (1:N) PasswordAttemptLog
       │
       └─── (N:1) User (leader via leaderId)

Enigma ─┬─── (1:N) TeamEnigmaProgress
        │
        ├─── (1:N) PasswordAttemptLog
        │
        └─── (N:M) Parcours (via Parcours.requiredEnigmaIds)

Parcours ─── (1:N) TeamParcoursAccess
```

---

## Key Business Rules

### User-Team Relationship
- User can be in **at most one team** at a time
- User `teamId` must match Team `members` array
- User `role` is `leader` if `userId == Team.leaderId`, else `member`

### Team Payment
- Team must have `hasPaid: true` to submit password attempts
- Payment status set via Stripe webhook after successful checkout
- `paidAt` timestamp records when payment completed

### Enigma Progress
- When password attempt is submitted:
  1. Create entry in `PasswordAttemptLog` (always)
  2. Update/create entry in `TeamEnigmaProgress`:
     - Increment `attemptCount`
     - Update `lastAttemptAt`
     - Set `firstAttemptAt` if first attempt
     - If correct: Set `solved: true`, `solvedAt: timestamp`
  3. If correct, update Team:
     - Add `enigma.points` to `team.points`
     - Increment `team.solvedEnigmasCount`
     - Update `team.lastActivityAt`
  4. Check if any parcours should unlock

### Parcours Unlocking
- Parcours unlocks when team has solved at least `parcours.requiredEnigmasCount` of the enigmas in `parcours.requiredEnigmaIds`
- When unlocked, create entry in `TeamParcoursAccess`:
  - `hasAccess: true`
  - `unlockedAt: timestamp`
  - `unlockedBy: [enigmaIds that were solved]`

### Password Matching
- Passwords are matched **case-insensitively**
- Normalize both stored and submitted passwords before comparison

---

## Jeu de l'oie (édition 2027)

Trois tables dédiées, préfixées `oie-`, isolées du modèle commun : l'énigme est
un essai, et elle doit pouvoir disparaître sans laisser de trace ailleurs.
Aucun champ n'est ajouté à `Enigma`, `Team` ou `TeamEnigmaProgress`.

Le lien avec le reste du jeu tient en une ligne : arriver en case 63 écrit un
`TeamEnigmaProgress` `solved: true` sur l'énigme désignée par `enigmaId`, et
incrémente `solvedEnigmasCount` de l'équipe. Classement et statistiques la
comptent alors comme n'importe quelle autre énigme, sans modification.

### OieBoardConfig — table `${service}-oie-board`

Un seul enregistrement, `boardId = "default"` : le plateau est commun à toutes
les équipes.

```typescript
{
  boardId: "default",        // PK
  squares: OieSquare[],      // les 64 cases, 0 à 63
  rollsPerDay: number,       // quota par jour et par équipe (1 par défaut)
  enigmaId?: string,         // l'Enigma ordinaire que ce plateau résout
  updatedAt: string,         // ISO 8601
  updatedBy?: string         // userId de l'admin
}
```

```typescript
interface OieSquare {
  squareNumber: number,      // 0 à 63
  type: 'depart' | 'normale' | 'oie' | 'souffleur'
      | 'loge' | 'puits' | 'prison' | 'mort' | 'arrivee',
  question?: string,         // absente sur 0, 63, 58 et les cases oie
  acceptedAnswers: string[], // comparées après normalisation
  hint?: string,             // seulement sur une case souffleur
  flavor?: string            // texte d'ambiance, facultatif
}
```

`type` n'est jamais lu dans une charge utile : il découle du numéro de la case,
et le serveur le recalcule à chaque écriture. Les 64 cases tiennent dans un seul
enregistrement, très loin de la limite de 400 Ko.

**Cases spéciales**, fixées par les règles et non par la configuration :
`oie` = 9, 18, 27, 36, 45, 54 · `souffleur` = 14, 39, 50, 60 · `loge` = 19 ·
`puits` = 31 · `prison` = 52 · `mort` = 58.

### OieTeamState — table `${service}-oie-team-state`

Un enregistrement par équipe, créé à la volée à la première ouverture du plateau.

```typescript
{
  teamId: string,               // PK
  position: number,             // 0 à 63
  questionPending: boolean,     // une question attend une réponse
  inPuits: boolean,             // bloqué en 31 jusqu'à ce qu'une autre équipe y tombe
  inPrison: boolean,            // purge la peine de la 52, libérable par une autre équipe
  nextRollAllowedDay: string,   // "YYYY-MM-DD", Europe/Paris
  rollsUsedToday: number,
  rollsDay: string,             // jour auquel se rapporte le compteur ci-dessus
  totalRolls: number,
  wrongAnswers: number,
  hintedSquares: number[],      // cases dont l'indice du souffleur a été demandé
  overshootCount: number,       // fois où l'équipe a raté la 63 pile
  finishedAt?: string,          // ISO 8601, posé à l'arrivée
  finishRank?: number,          // 1 pour la première équipe arrivée
  createdAt: string,
  updatedAt: string,
  version: number               // incrémenté à chaque écriture
}
```

`version` porte la concurrence. Deux membres d'une même équipe peuvent cliquer
« Lancer les dés » au même instant ; chaque écriture est conditionnée à la
version lue, si bien qu'un seul lancer est compté et que le second reçoit un
409. Sans cette condition, l'équipe avancerait deux fois pour un seul quota.

**Passer un tour** est modélisé par `nextRollAllowedDay` plutôt que par un
compteur de tours : tomber sur la loge le jour D le porte à D+2, la prison à
D+3. Libérer une équipe le ramène au jour courant.

**Le quota du jour** n'est pas remis à zéro par une tâche planifiée : quand
`rollsDay` n'est plus le jour courant, `rollsUsedToday` est considéré comme nul.
Rien ne tourne la nuit, et changer `rollsPerDay` prend effet immédiatement.

### OieEvent — table `${service}-oie-events`

Le journal du plateau : tout ce qui s'y passe, pour le fil d'événements et pour
l'analyse d'après course.

```typescript
{
  boardId: "default",        // PK, une seule partition
  eventKey: string,          // SK, `${occurredAt}#${eventId}`
  eventId: string,           // UUID v4
  type: 'lancer' | 'deplacement' | 'reponse_juste' | 'reponse_fausse'
      | 'case_speciale' | 'liberation' | 'souffleur' | 'arrivee'
      | 'reinitialisation',
  teamId: string,
  teamName: string,
  userId?: string,           // qui a cliqué
  occurredAt: string,        // ISO 8601
  message: string,           // phrase française prête à afficher
  detail?: object            // dés, positions, effet : jamais affiché tel quel
}
```

**GSI** `teamId-occurredAt-index` : PK=`teamId`, SK=`occurredAt`, pour relire
l'histoire d'une équipe.

Les lignes d'un même lancer sont décalées d'une milliseconde chacune : sans
cela elles partageraient l'horodatage, la clé de tri les départagerait par
identifiant, et le fil raconterait l'histoire dans le désordre.

`detail` ne quitte jamais le serveur : le fil envoyé aux joueurs ne porte que
`message`.

### Ce que le serveur ne dit jamais

- les réponses acceptées, sur aucune case ;
- la question d'une autre case que celle où se tient l'équipe (sinon une équipe
  préparerait tout le plateau en regardant où sont les autres) ;
- l'indice d'une case du souffleur tant qu'il n'a pas été demandé ;
- les questions, réponses et tentatives des autres équipes.

---

## DynamoDB Table Specifications

### Table Configuration
- **Billing Mode**: On-demand (pay-per-request)
- **Encryption**: At rest using AWS managed keys
- **Backup**: Point-in-time recovery enabled
- **TTL**: Not used (data retained indefinitely)

### Global Secondary Indexes (GSIs)

**Users Table**:
- `cognitoSub-index`: PK=`cognitoSub` (for login lookup)

**Enigmas Table**:
- `enigmaNumber-index`: PK=`enigmaNumber` (for ordered retrieval)

**Parcours Table**:
- `parcoursNumber-index`: PK=`parcoursNumber` (for ordered retrieval)

**TeamEnigmaProgress Table**:
- `enigmaId-solvedAt-index`: PK=`enigmaId`, SK=`solvedAt` (for leaderboards)

**PasswordAttemptLog Table**:
- `teamId-attemptedAt-index`: PK=`teamId`, SK=`attemptedAt`
- `enigmaId-attemptedAt-index`: PK=`enigmaId`, SK=`attemptedAt`
- `teamEnigma-index`: PK=`teamEnigmaKey`, SK=`attemptedAt`

**Teams Table** (optional for leaderboard):
- `points-index`: PK=`points`, SK=`teamName` (for global ranking)

**GameStatus Table**:
- No GSIs (single record access by gameId)

**Oie tables** (édition 2027) :
- `oie-board` : PK=`boardId`, pas de GSI (un seul enregistrement)
- `oie-team-state` : PK=`teamId`, pas de GSI
- `oie-events` : PK=`boardId`, SK=`eventKey` ; GSI `teamId-occurredAt-index`

---

## Data Consistency Notes

1. **Dual Writes**: Password attempts write to 2 tables (PasswordAttemptLog + TeamEnigmaProgress)
2. **Transactions**: Use DynamoDB transactions when:
   - Updating team points + enigma progress + parcours access
   - Critical operations requiring atomicity
3. **Eventual Consistency**: GSI queries are eventually consistent
4. **Idempotency**: Password attempt submission should be idempotent (check if already solved)

---

## Frontend Type Compatibility

Frontend TypeScript types should match these models. When API returns data, it follows these schemas exactly (except `correctPassword` which is never exposed).

See `API_CONTRACT.md` for endpoint response formats.
