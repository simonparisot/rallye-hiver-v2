# DynamoDB Schema - Rallye d'Hiver v2

## Current Tables (Existing)

### Users Table: `rallye-hiver-backend-users-{stage}`
- **Primary Key**: `userId` (UUID)
- **GSI**: `cognitoSub-index` on `cognitoSub`
- **Attributes**:
  - `cognitoSub` (String) - Cognito user identifier
  - `email` (String) - User email
  - `displayName` (String) - Display name
  - `teamId` (String, nullable) - Team membership
  - `role` (String, nullable) - 'leader' | 'member'
  - `createdAt` (String) - ISO 8601 timestamp
  - `updatedAt` (String) - ISO 8601 timestamp

### Teams Table: `rallye-hiver-backend-teams-{stage}`
- **Primary Key**: `teamId` (UUID)
- **Attributes**:
  - `teamName` (String) - Team name
  - `leaderId` (String) - User ID of leader
  - `hasPaid` (Boolean) - Payment status
  - `stripePaymentId` (String, nullable) - Stripe payment reference
  - `members` (Array\<String\>) - Array of user IDs
  - `pendingRequests` (Array\<String\>) - Array of user IDs
  - `createdAt` (String) - ISO 8601 timestamp
  - `paidAt` (String, nullable) - ISO 8601 timestamp
  - **NEW FIELDS**:
  - `points` (Number, default: 0) - Total points earned
  - `solvedEnigmasCount` (Number, default: 0) - Count of solved enigmas
  - `lastActivityAt` (String, nullable) - Last attempt timestamp

---

## New Tables (For Game Content & Progress)

### Enigmas Table: `rallye-hiver-backend-enigmas-{stage}`
- **Primary Key**: `enigmaId` (UUID)
- **GSI**: `enigmaNumber-index` on `enigmaNumber` (for ordered retrieval)
- **Attributes**:
  - `enigmaNumber` (Number) - Sequential identifier (1-20)
  - `title` (String) - Enigma title/name
  - `description` (String, optional) - Short description
  - `pdfUrl` (String) - S3 URL to enigma PDF
  - `correctPassword` (String) - Solution password (case-insensitive comparison)
  - `points` (Number) - Points awarded when solved
  - `difficulty` (String, optional) - 'easy' | 'medium' | 'hard'
  - `isActive` (Boolean, default: true) - Whether enigma is currently active
  - `createdAt` (String) - ISO 8601 timestamp
  - `updatedAt` (String) - ISO 8601 timestamp
  - `gameId` (String, optional) - For multi-season support

**Example Item**:
```json
{
  "enigmaId": "e123e4567-e89b-12d3-a456-426614174000",
  "enigmaNumber": 1,
  "title": "Le Mystère de la Tour",
  "description": "Trouvez le code caché dans le plan",
  "pdfUrl": "s3://rallye-hiver-enigmas/2025/enigma-01.pdf",
  "correctPassword": "PARIS1889",
  "points": 10,
  "difficulty": "easy",
  "isActive": true,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

---

### Parcours Table: `rallye-hiver-backend-parcours-{stage}`
- **Primary Key**: `parcoursId` (UUID)
- **GSI**: `parcoursNumber-index` on `parcoursNumber` (for ordered retrieval)
- **Attributes**:
  - `parcoursNumber` (Number) - Sequential identifier (1-10)
  - `title` (String) - Parcours title/name
  - `description` (String, optional) - Short description
  - `pdfUrl` (String) - S3 URL to parcours PDF
  - `requiredEnigmaIds` (Array\<String\>) - Array of enigmaIds that must be solved to unlock
  - `requiredEnigmasCount` (Number) - How many of the required enigmas must be solved (for flexibility)
  - `isActive` (Boolean, default: true) - Whether parcours is currently active
  - `createdAt` (String) - ISO 8601 timestamp
  - `updatedAt` (String) - ISO 8601 timestamp
  - `gameId` (String, optional) - For multi-season support

**Example Item**:
```json
{
  "parcoursId": "p123e4567-e89b-12d3-a456-426614174001",
  "parcoursNumber": 1,
  "title": "Le Circuit des Monuments",
  "description": "Découvrez les secrets architecturaux",
  "pdfUrl": "s3://rallye-hiver-parcours/2025/parcours-01.pdf",
  "requiredEnigmaIds": ["e123e4567-...", "e234e5678-...", "e345e6789-..."],
  "requiredEnigmasCount": 3,
  "isActive": true,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

---

### Team Enigma Progress Table: `rallye-hiver-backend-team-enigma-progress-{stage}`
Tracks summary progress for each team on each enigma.

- **Primary Key**: `teamId` (String)
- **Sort Key**: `enigmaId` (String)
- **GSI**: `enigmaId-index` on `enigmaId` + `solvedAt` (for leaderboards and stats)
- **Attributes**:
  - `teamId` (String) - Team identifier
  - `enigmaId` (String) - Enigma identifier
  - `solved` (Boolean, default: false) - Whether enigma is solved
  - `solvedAt` (String, nullable) - ISO 8601 timestamp when solved
  - `attemptCount` (Number, default: 0) - Total number of attempts
  - `lastAttemptAt` (String, nullable) - ISO 8601 timestamp of last attempt
  - `firstAttemptAt` (String, nullable) - ISO 8601 timestamp of first attempt
  - `createdAt` (String) - ISO 8601 timestamp
  - `updatedAt` (String) - ISO 8601 timestamp

**Note**: Individual password attempts are stored in the Password Attempts Log table (see below).

**Example Item**:
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

---

### Password Attempts Log Table: `rallye-hiver-backend-password-attempts-{stage}`
**ADMIN LOG TABLE**: Stores ALL password attempts for ALL teams for ALL enigmas (required for admin audit logs).

- **Primary Key**: `attemptId` (UUID)
- **GSI 1**: `teamId-attemptedAt-index` on `teamId` (PK) + `attemptedAt` (SK) - Query all attempts by a team
- **GSI 2**: `enigmaId-attemptedAt-index` on `enigmaId` (PK) + `attemptedAt` (SK) - Query all attempts for an enigma
- **GSI 3**: `teamEnigma-index` on `teamEnigmaKey` (PK) + `attemptedAt` (SK) - Query attempts for specific team+enigma combination
- **Attributes**:
  - `attemptId` (String) - UUID for the attempt
  - `teamId` (String) - Team identifier
  - `enigmaId` (String) - Enigma identifier
  - `teamEnigmaKey` (String) - Composite key: `{teamId}#{enigmaId}` for efficient querying
  - `password` (String) - Password that was attempted
  - `success` (Boolean) - Whether the password was correct
  - `attemptedAt` (String) - ISO 8601 timestamp
  - `attemptedBy` (String, optional) - User ID who made the attempt
  - `ipAddress` (String, optional) - IP address of the attempt (for security)

**Example Item**:
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

---

### Team Parcours Access Table: `rallye-hiver-backend-team-parcours-access-{stage}`
Tracks which parcours each team has unlocked.

- **Primary Key**: `teamId` (String)
- **Sort Key**: `parcoursId` (String)
- **Attributes**:
  - `teamId` (String) - Team identifier
  - `parcoursId` (String) - Parcours identifier
  - `hasAccess` (Boolean, default: true) - Whether team has unlocked this parcours
  - `unlockedAt` (String) - ISO 8601 timestamp when unlocked
  - `unlockedBy` (Array\<String\>) - Array of enigmaIds that triggered the unlock
  - `createdAt` (String) - ISO 8601 timestamp

**Example Item**:
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

---

## Access Patterns & Queries

### 1. Get all enigmas (ordered)
- **Table**: Enigmas
- **Operation**: Scan or Query on `enigmaNumber-index`

### 2. Get all parcours (ordered)
- **Table**: Parcours
- **Operation**: Scan or Query on `parcoursNumber-index`

### 3. Get team progress on all enigmas
- **Table**: Team Enigma Progress
- **Operation**: Query with `teamId` as PK

### 4. Get team progress on specific enigma
- **Table**: Team Enigma Progress
- **Operation**: Query with `teamId` (PK) and `enigmaId` (SK)

### 5. Submit password attempt
- **Tables**: Password Attempts Log (PutItem) + Team Enigma Progress (UpdateItem)
- **Operation**:
  1. Create new attempt log entry in Password Attempts Log table
  2. Update Team Enigma Progress: increment attemptCount, update lastAttemptAt, set solved if correct

### 6. Get all password attempts for a team (ADMIN)
- **Table**: Password Attempts Log
- **Operation**: Query on `teamId-attemptedAt-index` with `teamId` as PK

### 7. Get all password attempts for an enigma (ADMIN)
- **Table**: Password Attempts Log
- **Operation**: Query on `enigmaId-attemptedAt-index` with `enigmaId` as PK

### 8. Get password attempts for specific team+enigma (ADMIN)
- **Table**: Password Attempts Log
- **Operation**: Query on `teamEnigma-index` with `teamEnigmaKey` as PK

### 9. Get accessible parcours for a team
- **Table**: Team Parcours Access
- **Operation**: Query with `teamId` as PK

### 10. Check if parcours is unlocked
- **Table**: Team Parcours Access
- **Operation**: GetItem with `teamId` and `parcoursId`

### 11. Leaderboard (teams by points)
- **Table**: Teams
- **Operation**: Scan and sort by `points` (or create GSI on points)

### 12. Enigma leaderboard (who solved first)
- **Table**: Team Enigma Progress
- **Operation**: Query on `enigmaId-index` with `solved = true`, sort by `solvedAt`

---

## Data Relationships

```
Teams (1) ─────┬─── (N) Team Enigma Progress
               │
               ├─── (N) Team Parcours Access
               │
               └─── (N) Password Attempts Log

Enigmas (1) ───┬─── (N) Team Enigma Progress
               │
               ├─── (N) Parcours.requiredEnigmaIds
               │
               └─── (N) Password Attempts Log

Parcours (1) ───── (N) Team Parcours Access
```

---

## TypeScript Interfaces

```typescript
// Enigma
interface Enigma {
  enigmaId: string;
  enigmaNumber: number;
  title: string;
  description?: string;
  pdfUrl: string;
  correctPassword: string;
  points: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  gameId?: string;
}

// Parcours
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
  gameId?: string;
}

// Team Enigma Progress
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

// Password Attempt Log (ADMIN)
interface PasswordAttemptLog {
  attemptId: string;
  teamId: string;
  enigmaId: string;
  teamEnigmaKey: string; // composite: "teamId#enigmaId"
  password: string;
  success: boolean;
  attemptedAt: string;
  attemptedBy?: string; // userId
  ipAddress?: string;
}

// Team Parcours Access
interface TeamParcoursAccess {
  teamId: string;
  parcoursId: string;
  hasAccess: boolean;
  unlockedAt: string;
  unlockedBy: string[];
  createdAt: string;
}

// Updated Team interface (additions)
interface Team {
  // ... existing fields ...
  points: number;
  solvedEnigmasCount: number;
  lastActivityAt?: string;
}
```

---

## Indexing Strategy

### Required GSIs:

1. **Enigmas Table**
   - `enigmaNumber-index`: PK=`enigmaNumber`, SK=none
   - Use case: Retrieve enigmas in order

2. **Parcours Table**
   - `parcoursNumber-index`: PK=`parcoursNumber`, SK=none
   - Use case: Retrieve parcours in order

3. **Team Enigma Progress Table**
   - `enigmaId-solvedAt-index`: PK=`enigmaId`, SK=`solvedAt`
   - Use case: Leaderboard per enigma (who solved first)

4. **Password Attempts Log Table**
   - `teamId-attemptedAt-index`: PK=`teamId`, SK=`attemptedAt`
   - Use case: Query all attempts by a team (admin logs)
   - `enigmaId-attemptedAt-index`: PK=`enigmaId`, SK=`attemptedAt`
   - Use case: Query all attempts for an enigma (admin logs)
   - `teamEnigma-index`: PK=`teamEnigmaKey`, SK=`attemptedAt`
   - Use case: Query attempts for specific team+enigma combination (admin logs)

5. **Teams Table** (optional)
   - `points-index`: PK=`points`, SK=`solvedAt` or `teamName`
   - Use case: Global leaderboard

---

## Notes & Considerations

1. **Password Storage**: Store correct passwords encrypted at rest (DynamoDB encryption)
2. **ALL Attempts Logged**: Every password attempt is stored in the Password Attempts Log table for admin audit purposes (no limits)
3. **Dual Write on Attempts**: When a password is attempted, write to BOTH:
   - Password Attempts Log table (create new item with attemptId)
   - Team Enigma Progress table (update attemptCount, timestamps, solved status)
4. **Case Sensitivity**: Normalize passwords to uppercase/lowercase before comparison
5. **Rate Limiting**: Consider rate limiting password attempts per team to prevent brute force
6. **PDF Storage**: Use S3 with signed URLs or CloudFront for PDF delivery
7. **Caching**: Consider caching enigmas/parcours list (rarely changes)
8. **Transactions**: Use DynamoDB transactions when updating multiple tables (e.g., solving enigma → update progress + team points + unlock parcours + log attempt)
9. **Batch Operations**: Use BatchGetItem for retrieving multiple enigma progress items
10. **Admin Queries**: Password Attempts Log table supports efficient admin queries by team, enigma, or team+enigma combination
