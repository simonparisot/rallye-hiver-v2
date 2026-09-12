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
  solution?: string;           // Démarche de résolution détaillée, fausses pistes comprises
                               // (NOT exposed to clients — sert au choix d'indice)
  hints?: EnigmaHint[];        // Indices pré-écrits, ordre croissant
                               // (NOT exposed to clients — seul hintsCount l'est)
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

**Security Note**: `correctPassword`, `solution` et `hints` ne sont JAMAIS renvoyés
aux clients. `GET /enigmas` et `GET /enigmas/{enigmaId}` remplacent `hints` par
`hintsCount` (un simple entier), qui suffit au joueur pour savoir s'il peut
demander un indice. Le texte d'un indice n'atteint une équipe que par
`POST /hints/{enigmaId}/request`, une fois payé.

---

### EnigmaHint

Sous-objet stocké dans le tableau `hints` de l'énigme. Il n'a pas de table à lui :
les indices n'existent que dans le contexte de leur énigme.

```typescript
interface EnigmaHint {
  id: string;                  // Identifiant stable dans l'énigme (ex. "h1")
  order: number;               // Rang, du plus précoce (1) au plus tardif
  text: string;                // Texte affiché à l'équipe, tel quel
}
```

`id` ne doit jamais être réattribué : une demande archivée y renvoie. Un
réordonnancement change `order`, pas `id`.

**Exemple** :
```json
{ "id": "h3", "order": 3, "text": "Retournez chaque cadran comme dans un miroir." }
```

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
  hintsRequested?: number;     // Nombre d'indices demandés sur cette énigme
                               // (compteur d'usage : aucun effet sur le score
                               //  pendant l'essai)
  lastHintAt?: string;         // ISO 8601 timestamp du dernier indice obtenu
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
}
```

Remplace les anciens champs `hintUsed` / `hintUsedAt` (booléen d'usage du PDF
d'indice), retirés avec l'ancien mécanisme.

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
  "hintsRequested": 2,
  "lastHintAt": "2025-01-20T14:02:10Z",
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

### HintRequest
**Table**: `rallye-hiver-backend-hint-requests-{stage}`
**Primary Key**: `requestId` (UUID)
**GSI**: `teamEnigmaKey-requestedAt-index` sur `teamEnigmaKey` + `requestedAt`

Une ligne par demande d'indice. C'est à la fois le journal que l'organisateur
relit et la source de vérité de ce qu'une équipe a déjà reçu : la liste des
indices déjà donnés est reconstruite depuis cette table, pas depuis la
progression.

```typescript
type HintRequestStatus = 'pending' | 'processing' | 'done' | 'failed';

interface HintRequest {
  requestId: string;           // UUID, clé primaire
  teamId: string;              // Équipe demandeuse
  enigmaId: string;            // Énigme concernée
  teamEnigmaKey: string;       // Composite "teamId#enigmaId", clé de la GSI
  status: HintRequestStatus;   // Voir ci-dessous
  requestedAt: string;         // ISO 8601
  requestedBy: string;         // userId de la personne qui a cliqué
  progressText: string;        // Texte libre écrit par l'équipe (20 à 3 000 car.)
  excludedHintIds?: string[];  // Indices déjà donnés au moment de la demande
  hintId?: string;             // Identifiant de l'indice choisi (status done)
  hintText?: string;           // Texte de l'indice tel qu'il a été livré
  justification?: string;      // Note interne du modèle, jamais montrée à l'équipe
  model?: string;              // Identifiant du modèle appelé
  inputTokens?: number;        // Jetons consommés, si connus
  outputTokens?: number;
  failureReason?: string;      // Renseignée quand status vaut failed
  processingStartedAt?: string;// Pose du verrou par le worker
  completedAt?: string;
  pointsCharged: number;       // 0 pendant l'essai (barème en sommeil)
}
```

**Cycle de vie du statut.** Il dépend du réglage `HINT_PROVIDER` :

| Mode | Naissance | Suite |
|---|---|---|
| `anthropic` | `done` directement | la lambda appelle l'API et conclut dans la même requête |
| `queue` | `pending` | le worker la prend (`pending` -> `processing`, écriture conditionnelle), puis `done` ou `failed` |

Le passage `pending` -> `processing` est une écriture conditionnelle : c'est ce
qui garantit qu'une demande n'est jamais traitée deux fois, même si deux workers
tournent par mégarde.

Seules les demandes `done` consomment un indice. Une demande `failed` n'a rien
livré : l'indice reste disponible et l'équipe peut redemander.

`hintText` est recopié plutôt que référencé : si l'organisateur réécrit un
indice en cours de rallye, le journal garde ce que l'équipe a réellement lu.

**Écriture** : en mode `anthropic`, une ligne n'est écrite qu'après un choix
d'indice abouti, et un appel en échec n'en laisse aucune. En mode `queue`, la
ligne est écrite dès la demande, avec le statut `pending` ; c'est le statut, et
non la présence de la ligne, qui dit si l'indice a été livré.

**Access Patterns** :
- Indices déjà obtenus par une équipe sur une énigme : Query GSI sur
  `teamEnigmaKey = "{teamId}#{enigmaId}"`, trié par `requestedAt`
- Demandes à traiter (worker) : Scan filtré sur `status = "pending"`. Pas d'index
  dédié : une poignée de lignes en attente à un instant donné ne le justifie pas
- Journal de l'administrateur : Scan complet, filtré et trié en mémoire
  (quelques centaines de lignes par édition)

**Example**:
```json
{
  "requestId": "9f1c1e0a-...",
  "teamId": "t123e4567-...",
  "enigmaId": "e123e4567-...",
  "teamEnigmaKey": "t123e4567-...#e123e4567-...",
  "requestedAt": "2026-01-20T14:02:10Z",
  "requestedBy": "u123e4567-...",
  "progressText": "On a relevé les sept horloges et tenté plusieurs additions...",
  "hintId": "h2",
  "hintText": "Relisez la lettre du propriétaire jusqu'au bout.",
  "status": "done",
  "model": "claude-fable-5-1",
  "inputTokens": 1840,
  "outputTokens": 62,
  "pointsCharged": 0
}
```

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
