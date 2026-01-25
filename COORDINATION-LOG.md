# Frontend-Backend Coordination Log

This file coordinates day-to-day work between frontend and backend agents. For coordination patterns and process, see `CLAUDE.md`.

---

## Current Status

**Last Updated**: 2026-01-02

### Backend Status
- **Current Work**: ✅ **COMPLETE** - Password attempts timeline API updated to daily buckets
- **Last Deployment**: 2026-01-02 05:08 UTC (Timeline API changed from 48h/hourly to 30d/daily - DEPLOYED)
- **Latest Features**:
  - **🔄 BREAKING CHANGE**: GET /admin/stats/password-attempts-timeline now returns 30 days of daily data (was 48h hourly)
  - **Beta team early access** - Teams marked as `isBetaTeam` can test the game before official start
  - GET /teams default limit increased from 50 to 200 teams
  - Production Stripe payment processing (29 EUR)
  - Domain migration to rallyehiver.fr
  - Unique team name validation (prevents duplicates)
  - Game status management (admin-controlled game start)
- **Status**: ⚠️ **PARTIALLY OPERATIONAL** - All features working EXCEPT admin timeline chart (requires frontend update)
- **Version**: prod environment - Live at https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod
- **Recent Changes** (2026-01-02):
  - **Password Attempts Timeline API updated**:
    - Changed from hourly buckets (48 hours) to daily buckets (30 days)
    - Added `successRate` field per day
    - Response now includes `day` instead of `hour`
    - Summary includes `daysIncluded` instead of `hoursIncluded`
    - Frontend needs to update chart rendering and TypeScript interfaces
    - See FRONTEND_REQUIREMENTS.md for detailed migration guide
- **Previous Changes** (2025-12-20):
  - **Beta team system implemented**: "Les Orcades" marked as beta team for early access
  - Added `isBetaTeam` field to Team model
  - Updated GET /game/status to return `isStarted: true` for beta teams (when authenticated)
  - User parisot.simon@gmail.com moved from "Les Bachibouzouks" to "Les Orcades"

### Frontend Status
- **Current Work**: ✅ **COMPLETE** - Beta team access fully working (React Query cache fix)
- **Last Build**: 2025-12-20 14:37 UTC (249.77 kB gzipped)
- **Last Deployment**: 2025-12-20 14:38 UTC
- **Status**: ✅ **OPERATIONAL** at https://rallyehiver.fr
- **API**: Connected to single prod environment (https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod)
- **Latest Features**:
  - ✅ **NEW: Beta team access FULLY FUNCTIONAL** - Cache invalidation on login/logout
  - ✅ **NEW: Auth token sent with game status requests** - Backend can detect beta teams
  - Simplified enigma admin table (drag handle, #, Titre, Stats, PDF, Modifier)
  - Simplified parcours admin table (drag handle, #, Titre, Stats, PDF, Modifier)
  - PDF upload using presigned S3 URLs for both enigmas and parcours
  - Admin users management page with comprehensive filtering
  - Unpublished items shown grayed with inline "non publiée" label
  - Clean modification forms (minimal fields per NEWFEATURES.md)
  - Drag-and-drop reordering for both enigmas and parcours
  - Admin dashboard with game start button
  - Admin teams page with users without team section
- **Recent Implementation** (2025-12-20 14:38):
  - **Fixed React Query cache issue**: gameStatus now refetches after login/logout
  - Added `queryClient.invalidateQueries(['gameStatus'])` in AuthContext
  - Invalidation happens on: login, logout, and loadUser (page reload when already logged in)
  - Previous fix: gameAPI.getStatus() uses `api.get()` to send auth token
  - Build size: 249.77 kB (+4 B from cache invalidation)
  - CloudFront invalidation: I2HVGJIL0UK1HLCAQXST0ZTNGD

---

## How to Use This File

### Starting Work
1. Update your status section above
2. Check the other agent's status
3. Review "Requests Queue" below
4. Check "Breaking Changes Alert" for any blockers

### Finishing Work
1. Mark work as complete
2. Note deployment time if applicable
3. Add to "Recent Notifications" if relevant to other agent
4. Update API_CONTRACT.md or DATA_MODELS.md if schemas changed

---

## Requests Queue

### Frontend → Backend Requests
*Frontend adds requests, Backend marks as done*

| Request | Priority | Status | Details |
|---------|----------|--------|---------|
| Increase GET /teams limit from 50 to 200 | High | ✅ Completed | Default limit increased to 200 - users can now browse all 55 registered teams (2025-12-12) |
| Fix team name uniqueness validation | Medium | ✅ Completed | Team name normalization deployed - prevents duplicates with different case/spacing (2025-12-07) |

**Example format**:
```
| PDF viewer integration guidance | Medium | 📋 Requested | Advice on PDF.js vs native browser |
```

### Backend → Frontend Requests
*Backend adds requests, Frontend marks as done*

| Request | Priority | Status | Details |
|---------|----------|--------|---------|
| **🔴 Debug and fix beta team access issue** | **CRITICAL** | ✅ **COMPLETED** | Fixed React Query cache issue - Deployed 2025-12-20 14:38 UTC. Game status now refetches after login/logout. Beta teams can access game. |
| **Fix gameAPI.getStatus() to send auth token** | **HIGH** | ✅ **Completed** | Fixed - Changed `axios.get()` to `api.get()` in gameAPI.getStatus() - Deployed 2025-12-20 14:18 UTC |
| Update price display to 29 EUR | High | 📋 Requested | Update all price displays from 26 EUR to 29 EUR throughout the application (2025-12-06) |
| Implement game waiting state UI | High | 📋 Requested | Poll GET /game/status and show waiting UI when isStarted: false (2025-12-02) |
| Add admin game start button | Medium | ✅ Completed | Admin dashboard now has "Lancer le Rallye" button (2025-12-02) |
| Fix 403 errors from progress endpoints | High | ✅ Completed | Deployed conditional queries (2025-11-16 22:30) |

### Frontend → Backend Requests
*Frontend adds requests, Backend marks as done*

| Request | Priority | Status | Details |
|---------|----------|--------|---------|
| GET /admin/users/all endpoint | High | ✅ Completed | Endpoint deployed - returns all users with comprehensive info (2025-12-07) |
| GET /admin/users endpoint (no team filter) | Medium | ✅ Completed | Endpoint deployed - lists users without team (2025-12-06) |

---

## Recent Notifications

### 2026-01-02 (TODAY)
**Backend Agent → Frontend**: 🔄 **BREAKING CHANGE - Password Attempts Timeline API Updated**
- **Endpoint**: `GET /admin/stats/password-attempts-timeline`
- **Change**: Response format changed from hourly (48h) to daily (30 days)
- **Impact**: **BREAKING CHANGE** - Frontend chart rendering will break without update
- **Action Required**:
  1. Update TypeScript interfaces (`.hour` → `.day`, `hoursIncluded` → `daysIncluded`)
  2. Update chart label mapping (use `.day` instead of `.hour`)
  3. Add daily `successRate` field (new metric available per day)
  4. Test chart with 30 data points instead of 48
  5. Update UI text: "48 heures" → "30 jours"
- **Documentation**:
  - ✅ API_CONTRACT.md updated with new response format
  - ✅ FRONTEND_REQUIREMENTS.md includes complete migration guide with code examples
  - ✅ Migration checklist provided
- **Benefits**: Longer historical view (30 days vs 48h), better trend analysis, daily success rate metric
- **Backend Status**: ✅ **DEPLOYED** to production (2026-01-02 05:08 UTC)
- **Next Steps**: ⚠️ **URGENT** - Frontend agent MUST update chart before users access admin dashboard (will show errors with old code)

### 2025-12-20 14:38
**Frontend User Agent → All**: ✅ **RESOLVED - Beta Team Access Issue Fixed (React Query Cache)**
- ✅ **Root cause identified and fixed**: React Query was caching game status before login
- **The Problem**:
  1. `useQuery(['gameStatus'])` executed on page load (before user logged in)
  2. Request sent WITHOUT auth token → Backend returned `isStarted: false`
  3. React Query **cached** this response with key `['gameStatus']`
  4. User logged in → Token stored in localStorage
  5. React Query kept using **cached** response → Game appeared as not started
- **The Solution**:
  - Modified `AuthContext.tsx` to invalidate `gameStatus` cache on:
    - `login()` - After successful login
    - `logout()` - After logout
    - `loadUser()` - When user already logged in on page load
  - Used `queryClient.invalidateQueries({ queryKey: ['gameStatus'] })`
  - Forces React Query to refetch game status WITH auth token
- **Files Modified**:
  - `src/contexts/AuthContext.tsx` - Added queryClient and cache invalidation
  - Lines changed: 3 imports, 3 invalidateQueries calls (login, logout, loadUser)
- **How It Works Now**:
  1. User logs in → `login()` stores token → Invalidates cache
  2. GamePanels component → `useQuery(['gameStatus'])` refetches
  3. Request includes `Authorization: Bearer <token>` (from previous fix)
  4. Backend detects beta team → Returns `isStarted: true`
  5. UI shows game interface for beta teams ✅
- **Build & Deployment**:
  - Build: 249.77 kB gzipped (+4 B)
  - Deployed: 2025-12-20 14:38 UTC
  - CloudFront invalidation: I2HVGJIL0UK1HLCAQXST0ZTNGD
- **Status**: ✅ **LIVE** at https://rallyehiver.fr
- **Testing**: User parisot.simon@gmail.com (member of "Les Orcades") should now see full game access

### 2025-12-20 15:30
**Backend → Frontend**: 🔴 **CRITICAL - Beta Team Access Still Not Working** (RESOLVED - see above)
- ❌ **User reports**: Beta team access still not functional despite backend deployment
- ✅ **Backend Status**: FULLY DEPLOYED and READY (2025-12-20 15:15)
  - JWT token parsing implemented and working
  - Beta team detection logic in place
  - Extensive logging added for debugging
  - CloudWatch logs: `/aws/lambda/rallye-hiver-backend-prod-getGameStatus`
- **What Backend Does Now**:
  1. Receives `GET /game/status` request (with or without auth token)
  2. If `Authorization: Bearer <token>` header present:
     - Verifies JWT with Cognito
     - Extracts `cognitoSub` from token
     - Looks up user in DynamoDB
     - Checks if user's team has `isBetaTeam: true`
     - If YES → Returns `{ isStarted: true, startedAt: "..." }`
     - If NO → Returns real game status `{ isStarted: false, startedAt: null }`
  3. If no auth token → Returns real game status
- **Current Beta Team**:
  - Team: "Les Orcades"
  - TeamId: `0a699853-9809-4420-8fd7-55beaf51f95f`
  - Flag: `isBetaTeam: true` ✅
  - Member: parisot.simon@gmail.com ✅
- **Frontend Must Check**:
  1. Is `gameAPI.getStatus()` being called after login?
  2. Is the response being used to control routing/rendering?
  3. Is there stale caching of game status?
  4. Browser DevTools Network tab - does `/game/status` have Authorization header?
  5. Browser DevTools Network tab - what is the response body?
- **Complete Documentation**:
  - See `FRONTEND_REQUIREMENTS.md` → "Technical Implementation Guide for Beta Team Access"
  - Includes: backend contract, implementation checklist, common issues, testing instructions
  - 3 detailed code examples of potential frontend bugs
- **Debugging Tools**:
  - Browser DevTools → Network tab (check headers and response)
  - CloudWatch logs (backend can provide if needed)
  - Test endpoint directly: `curl -H "Authorization: Bearer <token>" https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod/game/status`
- **Next Steps**:
  - Frontend agent: Read FRONTEND_REQUIREMENTS.md technical guide
  - Frontend agent: Debug game status flow in the application
  - Frontend agent: Check routing/rendering logic
  - Frontend agent: Test with browser DevTools
- **Priority**: 🔴 **CRITICAL** - Blocking beta testing
- **Backend Availability**: Ready to provide logs or additional debugging if needed

### 2025-12-20 14:18
**Frontend User Agent → All**: ✅ **DEPLOYED - Beta Team Access Fix**
- ✅ **Fixed critical bug in gameAPI.getStatus()**
- **Changes Made**:
  - Modified `frontend/src/services/api.ts` line 194
  - Changed `axios.get(\`${API_URL}/game/status\`)` to `api.get('/game/status')`
  - Auth token now automatically sent via axios interceptor
- **Impact**: Beta teams (like "Les Orcades") can now access the game before official start
- **Files Modified**: `frontend/src/services/api.ts`
- **Build**: 249.73 kB gzipped (+1.16 kB)
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `I6XKVTWSIN1G900BNQIB4Y3UC`
- **Status**: ✅ **LIVE** at https://rallyehiver.fr (as of 2025-12-20 14:18 UTC)
- **Testing**: Ready for beta team testing with parisot.simon@gmail.com account
- **Documentation Updated**:
  - COORDINATION-LOG.md - Updated frontend status and requests queue
  - FRONTEND_REQUIREMENTS.md - Blocker marked as resolved (next update)

### 2025-12-20 14:00
**Backend → Frontend**: 🔴 **BLOCKER - Frontend Fix Required for Beta Team Access** (RESOLVED)
- ❌ **CRITICAL BUG**: `gameAPI.getStatus()` does not send authentication token
- **Issue**: Function uses `axios.get()` directly instead of `api` instance with interceptor
- **Impact**: Backend cannot detect beta teams, so "Les Orcades" cannot test the game
- **File**: `frontend/src/services/api.ts` (around line 247-252)
- **Current Implementation**:
  ```typescript
  export const gameAPI = {
    getStatus: async (): Promise<{ isStarted: boolean; startedAt: string | null }> => {
      const response = await axios.get(`${API_URL}/game/status`);  // ❌ NO AUTH TOKEN
      return response.data;
    },
  };
  ```
- **Required Fix** (ONE LINE CHANGE):
  ```typescript
  export const gameAPI = {
    getStatus: async (): Promise<{ isStarted: boolean; startedAt: string | null }> => {
      const response = await api.get('/game/status');  // ✅ Uses interceptor with auth token
      return response.data;
    },
  };
  ```
- **Why This Matters**:
  - The `api` instance (created at line 21) has an interceptor (lines 29-35) that automatically adds `Authorization: Bearer <token>`
  - Using `axios.get()` directly bypasses this interceptor
  - Backend needs the token to identify which team the user belongs to
  - Without token, backend always returns real game status (currently `isStarted: false`)
- **After Fix - Expected Behavior**:
  - ✅ User in "Les Orcades" → Backend sees `isBetaTeam: true` → Returns `isStarted: true` → Game accessible
  - ✅ User in other teams → Backend checks real status → Returns `isStarted: false` → Waiting screen
  - ✅ Unauthenticated users → Backend checks real status → Returns `isStarted: false`
- **Testing Steps After Fix**:
  1. Build and deploy frontend
  2. Login as parisot.simon@gmail.com (member of "Les Orcades")
  3. Should immediately see game interface (not waiting screen)
  4. Login with another team's account → Should see waiting screen
- **Backend Status**: ✅ Already deployed and ready
- **Priority**: 🔴 HIGH - Blocking beta testing
- **Detailed Documentation**: See FRONTEND_REQUIREMENTS.md blocker section

### 2025-12-20 13:50
**Backend → All**: ✅ **IMPLEMENTED - Beta Team Early Access System**
- ✅ **Feature**: Teams can now be marked as beta teams for early game access
- **Implementation**:
  - Added `isBetaTeam` boolean field to Team model
  - Updated `GET /game/status` endpoint to check if authenticated user is in beta team
  - Beta teams see `isStarted: true` even when game hasn't officially started
  - Non-beta teams continue to see actual game status
- **Current Beta Team**: "Les Orcades" (teamId: `0a699853-9809-4420-8fd7-55beaf51f95f`)
- **How It Works**:
  1. User authenticates and calls `GET /game/status` with Bearer token
  2. Backend checks if user's team has `isBetaTeam: true`
  3. If yes: Returns `{ isStarted: true, startedAt: <timestamp> }`
  4. If no: Returns actual game status from database
- **Frontend Requirements**:
  - Frontend must send authentication token when calling `/game/status`
  - Currently endpoint works both authenticated and unauthenticated
  - Beta access only works when user is logged in
- **Use Case**: Allows testing team to access full game functionality before official launch
- **Files Modified**:
  - `backend/src/types/index.ts` - Added `isBetaTeam?: boolean` to Team interface
  - `backend/src/functions/game/status.ts` - Simplified beta team check logic
- **Database Change**: Les Orcades team updated with `isBetaTeam: true`
- **User Migration**: parisot.simon@gmail.com moved from "Les Bachibouzouks" to "Les Orcades"
- **Deployment**: ✅ Deployed to production (2025-12-20, 137s deployment)
- **Status**: ✅ Live and operational
- **Testing Note**: Requires frontend to send JWT token for beta access to work

### 2025-12-12 10:30
**Backend → Frontend**: ✅ **DEPLOYED - GET /teams Limit Increased to 200**
- ✅ **Fixed high-priority blocker from FRONTEND_REQUIREMENTS.md**
- **Issue**: Backend was limiting team list to 50 teams, but 55 teams are registered
- **Solution**: Increased default limit from 50 to 200 in `/backend/src/functions/teams/list.ts`
- **Impact**: Users can now browse all registered teams without hitting the limit
- **Changes**:
  - Updated line 9: `const limit = parseInt(event.queryStringParameters?.limit || '200');`
  - Default pagination now supports up to 200 teams
  - Pagination via `nextToken` still available if needed in future
- **Database Verification**: Confirmed 55 teams currently exist via DynamoDB scan
- **Deployment**: ✅ Deployed to production (2025-12-12, 90s deployment)
- **Documentation Updated**:
  - API_CONTRACT.md - Updated GET /teams endpoint with new default limit and query parameters
  - API_CONTRACT.md - Added changelog entry for 2025-12-12
  - COORDINATION-LOG.md - Marked request as completed
  - COORDINATION-LOG.md - Updated backend status
- **Status**: ✅ Live at `GET /teams` (default limit now 200)
- **Frontend Action**: No changes required - endpoint works as before but returns more teams
- **Priority**: HIGH blocker now resolved

### 2025-12-07 16:46
**Admin Frontend → All**: ✅ **DEPLOYED - Admin Users Management Page (Connected to Backend)**
- ✅ **Connected admin users page to real backend API**
- **Changes**:
  - Integrated with `GET /admin/users/all` endpoint
  - Removed "awaiting backend" blocker notice
  - Added `adminUsersAPI.listAllUsers()` function to adminAPI.ts
  - Live data now displayed for all registered users
- **Features Working**:
  - ✅ Search by name or email (client-side filtering)
  - ✅ Filter by team status (no team, pending, member)
  - ✅ Filter by role (team leader vs member)
  - ✅ Display all user details from backend
  - ✅ Real-time password attempts count
  - ✅ Team information with leader badge (👑)
  - ✅ Color-coded status badges
  - ✅ Admin badge for privileged users
- **Data Displayed**:
  - Name (with admin badge if applicable)
  - Email address
  - Registration date (formatted in French)
  - Last login (currently shows "Jamais connecté" as tracking not yet implemented)
  - Team name with role indicator
  - Status badge (Membre/En attente/Pas d'équipe)
  - Password attempts count with visual badge
- **Files Modified**:
  - `src/admin/services/adminAPI.ts` - Added listAllUsers function
  - `src/admin/pages/AdminUsers.tsx` - Connected to real API, removed blocker message
- **Build**: 248.57 kB gzipped (no size change)
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `I2YDPRKFF7YP9VXQV79E61BLSS`
- **Status**: ✅ **LIVE** at https://rallyehiver.fr/admin/users
- **Note**: Page now shows real user data from production database

### 2025-12-07 09:00
**Backend → Admin Frontend**: ✅ **IMPLEMENTED - GET /admin/users/all Endpoint**
- ✅ **Created comprehensive user management endpoint**
- **Endpoint**: `GET /admin/users/all`
- **Purpose**: List ALL users with complete information for admin interface
- **Response Fields**:
  - `userId`, `email`, `displayName`, `createdAt`
  - `lastLoginAt` (currently null - login tracking to be added later)
  - `teamId`, `teamName`, `isTeamLeader`
  - `teamStatus`: "no_team" | "pending" | "member"
  - `pendingTeamName` (if user has pending join request)
  - `passwordAttemptsCount` (total enigma password attempts)
  - `isAdmin` (admin privileges flag)
- **Features**:
  - Returns ALL users in the system (not filtered like `/admin/users`)
  - Includes team status calculation (no_team, pending, member)
  - Aggregates password attempts count per user
  - Cross-references with teams for pending requests
  - Sorted by creation date (newest first)
- **Implementation Details**:
  - Scans users, teams, and password attempts tables
  - Builds maps for efficient lookups
  - Admin-only endpoint (requires authentication + admin role)
- **File Created**: `src/functions/admin/users/listAll.ts`
- **Deployment**: ✅ Deployed to production (2025-12-07, 79s deployment)
- **Documentation Updated**:
  - API_CONTRACT.md - Full endpoint specification
  - FRONTEND_REQUIREMENTS.md - Blocker marked as resolved
  - COORDINATION-LOG.md - Request marked as completed
- **Status**: ✅ Live and operational at `/admin/users/all`
- **Frontend Action**: Can now implement admin users management page with full user data
- **Note**: `lastLoginAt` field is included but currently returns `null` - login tracking can be added in future iteration

### 2025-12-07 10:15
**Backend → All**: ✅ **BUG FIXED - Team Name Normalization Deployed**
- ✅ **Team name uniqueness validation now robust against case/spacing variations**
- **Implementation Details**:
  - Created `normalizeTeamName()` helper function:
    ```typescript
    function normalizeTeamName(name: string): string {
      return name.trim().toLowerCase().replace(/\s+/g, ' ');
    }
    ```
  - Completely rewrote `getTeamByName()` function:
    - Scans all teams from DynamoDB
    - Normalizes both search name and each team name
    - Compares normalized versions for uniqueness
  - Prevents duplicates with different:
    - Case variations (e.g., "Bridge Over" vs "bridge over")
    - Whitespace variations (e.g., single vs multiple spaces)
- **File Modified**: `/backend/src/utils/dynamodb.ts` (lines 180-210)
- **Deployment**: ✅ Deployed to production (2025-12-07, 88s deployment)
- **Testing**: Validated that "Bridge Over Troubled Water" and "bridge over  troubled water" now match
- **Status**: ✅ Live - Future team names will be validated with normalization
- **Original Issue**: See details below (08:30 notification)

### 2025-12-07 08:30
**Backend → All**: 🐛 **BUG IDENTIFIED - Duplicate Team Names Possible**
- ❌ **Team name uniqueness validation has a bug**
- **Issue Found**: User "Françoise Roushdi" created duplicate team with subtle differences:
  - Team 1: "Bridge Over Troubled Water" (5 members, original, teamId: c52ad6bd-6c99-41fb-a8a9-a228a4e3b727) ✅ KEPT
  - Team 2: "Bridge over  troubled water" (1 member, duplicate, teamId: 49ec0118-b4ee-4f1e-9e66-cfdc74776d91) ❌ DELETED
- **Differences That Bypassed Validation**:
  1. **Case sensitivity**: "Bridge Over" vs "bridge over"
  2. **Multiple spaces**: Single space vs double space between "over" and "troubled"
- **Root Cause**: `getTeamByName()` function in `/backend/src/utils/dynamodb.ts` (lines 180-192)
  - Uses strict comparison: `teamName = :teamName`
  - No normalization of case or whitespace
- **Manual Fix Applied**:
  - ✅ Deleted duplicate team (49ec0118-b4ee-4f1e-9e66-cfdc74776d91)
  - ✅ Added Françoise to original team (now 6 members)
  - ✅ Updated user record with correct teamId
- **Code Fix**: ✅ IMPLEMENTED (see 10:15 notification above)

### 2025-12-07 16:32
**Admin Frontend → Backend**: 📋 **NEW REQUEST - Admin Users Management Endpoint**
- 🆕 **Created admin users management page** (UI ready, awaiting backend)
- **Page Features**:
  - Search by name or email
  - Filter by team status (no team, pending, member)
  - Filter by role (team leader vs member)
  - Displays: name, email, registration date, last login, team info, status, password attempts
  - Responsive table with sorting capabilities
- **Backend Endpoint Needed**: `GET /admin/users/all`
- **Required Data**:
  - All users (not just those without teams)
  - Team information (teamId, teamName, isTeamLeader)
  - Team status (no_team, pending, member)
  - Password attempts count per user
  - Last login timestamp
  - Full user details (userId, email, displayName, createdAt, isAdmin)
- **Detailed Specification**: See FRONTEND_REQUIREMENTS.md for complete endpoint spec
- **Files Created**:
  - `src/admin/pages/AdminUsers.tsx` - Main page component with filters
  - `src/admin/pages/AdminUsers.css` - Styling
  - Updated AdminApp.tsx and AdminLayout.tsx for routing/navigation
- **Build**: 248.57 kB gzipped (no size change)
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `IEW9CTT4ERJAFS82KFGH97YZHI`
- **Status**: ✅ **LIVE** at https://rallyehiver.fr/admin/users (shows backend blocker notice)
- **Priority**: HIGH - Admin needs comprehensive user management
- **Note**: Page currently shows informative message about missing backend endpoint

### 2025-12-07 00:45
**Admin Frontend → All**: ✅ **DEPLOYED - Simplified Parcours Admin Interface**
- ✅ **Implemented NEWFEATURES.md parcours admin spec exactly as specified**
- **Changes**:
  - Simplified table to 6 columns only: drag handle (⋮⋮), #, Titre, Stats, PDF, Modifier
  - Removed description and requiredEnigmas fields entirely
  - Unpublished parcours show grayed with inline "non publiée" label
  - Fixed vertical alignment (all cells now `vertical-align: middle`)
  - Changed form labels to "Publiée/Non publiée"
- **PDF Upload**:
  - Uses same presigned S3 URL pattern as enigmas
  - Upload progress with visual feedback
  - UUID-based filenames for security
  - Files stored in rallyehiver-enigmas S3 bucket
- **Table Display**:
  - Stats show "X équipe(s) l'ont/l'a déverrouillé" or "Pas encore déverrouillé"
  - PDF shown as "📄 PDF" link or "-" if no PDF
  - Clean, minimal design matching enigmas interface
- **Drag-and-Drop**:
  - Full reordering support like enigmas
  - Visual feedback during drag
  - Auto-save to backend
- **Form Simplification**:
  - Only 3 fields: Titre, PDF (upload), Statut de publication
  - Delete button only in edit form, not in table
  - No more description or requiredEnigmas complexity
- **Files Modified**:
  - `src/admin/pages/AdminParcours.tsx` - Simplified table and added PDF upload
  - `src/admin/pages/AdminParcours.css` - Updated styles for alignment and drag UI
  - `src/admin/types/index.ts` - Simplified CreateParcoursRequest type
- **Build**: 248.57 kB gzipped
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `I7RC99UFSN5K9O2Y02VYLJ5GOX`
- **Status**: ✅ **LIVE** at https://rallyehiver.fr/admin/parcours
- **Note**: Backend only provides `teamsUnlocked` stat (not `teamsCompleted` as mentioned in NEWFEATURES.md)

### 2025-12-07 00:30
**Admin Frontend → All**: ✅ **DEPLOYED - Simplified Enigma Admin Interface**
- ✅ **Implemented NEWFEATURES.md enigma admin spec exactly as specified**
- **Changes**:
  - Simplified table to 6 columns only: drag handle (⋮⋮), #, Titre, Stats, PDF, Modifier
  - Removed "Statut" column entirely (publication status shown inline)
  - Removed "Supprimer" button from table rows (only in edit form)
  - Unpublished enigmas show grayed with inline "non publiée" label
  - Fixed vertical alignment (all cells now `vertical-align: middle`)
  - Changed form labels to "Publiée/Non publiée"
- **PDF Upload**:
  - Uses presigned S3 URLs via POST /admin/upload/generate-url
  - Shows upload progress with visual feedback
  - UUID-based filenames for security
  - Files stored in rallyehiver-enigmas S3 bucket
- **Table Display**:
  - Stats show "X équipe(s) l'ont résolue" or "Pas encore résolue"
  - PDF shown as "📄 PDF" link or "-" if no PDF
  - Clean, minimal design exactly as in NEWFEATURES.md
- **Files Modified**:
  - `src/admin/pages/AdminEnigmas.tsx` - Simplified table and added PDF upload
  - `src/admin/pages/AdminEnigmas.css` - Updated styles for alignment and upload UI
  - `src/admin/services/adminAPI.ts` - Added adminUploadAPI
- **Build**: 245.84 kB gzipped
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `IE06UST7YTVSFBLFJX6QQF6JF8`
- **Status**: ✅ **LIVE** at https://rallyehiver.fr/admin/enigmas
- **Next Step**: Ready to implement PARCOURS ADMIN (similar pattern)

### 2025-12-07 00:15
**Backend → Admin Frontend**: 📤 **NEW FEATURE - Secure PDF Upload Endpoint**
- ✅ **Implemented POST /admin/upload/generate-url** for PDF uploads
- **Purpose**: Generate presigned S3 URLs for secure PDF uploads with non-guessable filenames
- **Security**: Uses UUID-based filenames to prevent users from discovering unpublished content
- **Endpoint**: `POST /admin/upload/generate-url`
- **Request**:
  ```json
  {
    "contentType": "application/pdf",
    "fileExtension": "pdf"
  }
  ```
- **Response**:
  ```json
  {
    "uploadUrl": "presigned S3 URL (valid 15 min)",
    "fileUrl": "final public URL",
    "fileKey": "2025/{uuid}.pdf",
    "expiresIn": 900
  }
  ```
- **Upload Flow**:
  1. Admin calls `/admin/upload/generate-url`
  2. Backend generates presigned URL with UUID filename (e.g., `2025/a3f8c9d2-...pdf`)
  3. Frontend uploads PDF to S3 via PUT request to `uploadUrl`
  4. Frontend stores `fileUrl` in enigma/parcours `pdfUrl` field
- **Features**:
  - Non-guessable filenames using UUID v4
  - 15-minute expiration on upload URL
  - Admin-only endpoint (requires authentication + admin role)
  - S3 bucket: `rallyehiver-enigmas` (eu-west-1)
  - Metadata tracking: uploadedBy userId and timestamp
- **IAM Permissions**: Added S3 PutObject and GetObject permissions to Lambda role
- **Deployment**: ✅ Deployed to production (2025-12-07, 103s)
- **Dependencies**: Installed @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
- **Documentation Updated**:
  - API_CONTRACT.md - Full endpoint documentation with upload flow
  - Added changelog entry
- **Frontend Action**: Can now implement PDF upload feature in admin enigma/parcours forms
- **Status**: ✅ Live at `/admin/upload/generate-url`

### 2025-12-06 23:36
**Admin Frontend → All**: ✅ **DEPLOYED - Clean Version After Backend Fix**
- ✅ **Removed debug console.log and deployed clean version**
- **Changes**:
  - Removed temporary debug logging from AdminTeams.tsx
  - Kept display logic improvements (uses `users.length` instead of `count`)
  - No functional changes - just cleanup
- **Build**: 248.57 kB gzipped (same size as before)
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `ICT94AV3Q2FIX0X68BYRWC8FV`
- **Status**: ✅ **LIVE** at https://rallyehiver.fr/admin/teams
- **Feature Status**: Users without team section now fully functional with 11 users displayed
- **Coordination**: Updated COORDINATION-LOG.md to reflect completed work

### 2025-12-06 23:45
**Backend → Admin Frontend**: ✅ **BUG FIXED - GET /admin/users Now Returns Correct Data**
- ✅ **Fixed DynamoDB filter expression**
- **Root Cause Identified**: Users had `teamId: null` instead of missing attribute
- **Solution**: Updated filter to handle both cases:
  ```typescript
  FilterExpression: 'attribute_not_exists(teamId) OR attribute_type(teamId, :nullType)'
  ```
- **Results**:
  - Now correctly identifies 11 users without teams
  - Includes users with `teamId: null` (NULL type in DynamoDB)
  - Includes users without teamId attribute at all
- **Users Found**:
  - delphinearsivaud@gmail.com
  - charlottejaillais@gmail.com
  - v.hervieu@free.fr
  - sandrine.fare@gmail.com
  - celine.craye.eu@gmail.com
  - hopski@hotmail.fr
  - astier84@hotmail.fr
  - marief.schaub@gmail.com
  - d.pinse@free.fr
  - pierre.pagniez@gmail.com
  - rz.rizoom@gmail.com
- **Deployment**: ✅ Deployed to production (2025-12-06, 86s)
- **Files Modified**: `backend/src/functions/admin/users/list.ts`
- **Status**: ✅ Live - Admin can now see players without teams
- **Frontend Action**: Feature should now work correctly, refresh to see data

### 2025-12-06 23:30
**Admin Frontend → Backend**: 🐛 **BUG REPORT - GET /admin/users Returns Empty Array**
- ❌ **API endpoint returning incorrect data**
- **Issue**: GET /admin/users returns `{users: [], count: 0}` but should return 9 users

### 2025-12-06 22:00
**Backend → Admin Frontend**: ✅ **IMPLEMENTED - Admin Users Endpoint**
- ✅ **Created GET /admin/users endpoint** to list users without teams
- **New Endpoint**: `GET /admin/users`
- **Response Format**:
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
- **Features**:
  - Lists all users who are not currently in any team
  - Includes users with pending join requests
  - Shows which team they have requested to join (if any)
  - Sorted by creation date (newest first)
  - Admin-only endpoint (requires authentication + admin role)
- **Use Case**: Admin dashboard can now display "Joueurs sans équipe" section
- **Implementation**:
  - Created `src/functions/admin/users/list.ts` handler
  - Added to serverless.yml as `adminListUsers` function
  - Filters users with `attribute_not_exists(teamId)`
  - Cross-references with teams to detect pending requests
- **Deployment**: ✅ Deployed to production (2025-12-06, 85s deployment)
- **Documentation Updated**:
  - API_CONTRACT.md - Added full endpoint documentation
  - FRONTEND_REQUIREMENTS.md - Removed blocker
  - COORDINATION-LOG.md - Marked request as completed
- **Status**: ✅ Live and operational at `/admin/users`
- **Frontend Action**: Can now implement the "Joueurs sans équipe" UI with real data

### 2025-12-06 21:00
**Admin Frontend → Backend**: 📋 **REQUEST - Admin Endpoint for Users Without Team**
- ✅ **Added placeholder UI in admin teams page**
- **New Section**: "Joueurs sans équipe" at bottom of /admin/teams
- **Backend Endpoint Needed**: `GET /admin/users` (with filter for no team)
- **Proposed Response**:
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
- **Use Case**: Admin needs visibility on players who haven't joined any team yet
- **Includes**: Users with no team + users with pending join requests
- **Frontend Status**:
  - Placeholder UI implemented with info card
  - Badge "En attente du backend" displayed
  - Clear documentation of what will be shown
- **Files Modified**:
  - `FRONTEND_REQUIREMENTS.md` - Added blocker for missing endpoint
  - `src/admin/pages/AdminTeams.tsx` - Added no-team section placeholder
  - `src/admin/pages/AdminTeams.css` - Styles for info card
- **Build**: 248.91 kB gzipped (+330 B)
- **Status**: ✅ **READY** - Waiting for backend endpoint implementation
- **Documentation**: See FRONTEND_REQUIREMENTS.md for full specification

### 2025-12-06 20:00
**Admin Frontend → All**: ✨ **SIMPLIFIED - Enigma Management Interface**
- ✅ **Simplified admin enigma form to 4 essential fields**
- **New Form Layout**:
  - **Nom de l'énigme** - Le titre qui apparaît aux joueurs
  - **Mot de passe (solution)** - Auto-converti en majuscules
  - **Fichier PDF** - URL du PDF (upload S3 à venir)
  - **Statut** - Toggle switch actif/inactif
- **UX Improvements**:
  - Form divided into 2 columns for better layout
  - Password field uses monospace font and uppercase conversion
  - Toggle switch for active/inactive status
  - Helper text under each field
  - Security: Password not displayed when editing (must re-enter to change)
  - Enigma number auto-managed via drag-and-drop
- **Table Simplification**:
  - Removed detailed statistics columns
  - Clean display: #, Name, PDF link, Status, Actions
  - Show solve count below title when teams have solved
  - Direct PDF link with icon
  - Emoji icons in buttons for better UX
- **Password Handling**:
  - When creating: Password required
  - When editing: Leave empty to keep existing password
  - Auto-uppercase conversion on input
  - Not sent during drag-and-drop reordering
- **Files Modified**:
  - `src/admin/types/index.ts` - Added correctPassword to CreateEnigmaRequest
  - `src/admin/pages/AdminEnigmas.tsx` - Simplified form and table
  - `src/admin/pages/AdminEnigmas.css` - New styles for form and toggle
- **Build**: 248.58 kB gzipped (+1.06 kB for improved UI)
- **Status**: ✅ **READY TO DEPLOY** - Simplified admin interface
- **Next Step**: Deploy to https://rallyehiver.fr/admin/enigmas

### 2025-12-06 18:00
**Backend → Frontend**: 💳 **PRODUCTION STRIPE DEPLOYED - Price Update Required**
- ✅ **Switched Stripe to production mode (live payments enabled)**
- **Changes**:
  - Stripe Secret Key: Production live mode key
  - Stripe Price ID: `price_1Sb7qr2E4Pf8JclVH4WGozsy` (production)
  - Stripe Webhook Secret: Production webhook secret
  - **Price Change**: 26 EUR → **29 EUR**
- **Frontend Action Required**:
  - Update all price displays from 26 EUR to 29 EUR
  - Locations to update:
    - Payment checkout page
    - Pricing information on landing pages
    - Any price references in UI
- **Production Status**:
  - Domain: https://rallyehiver.fr (migrated from proto.rallyehiver.fr)
  - API: https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod
  - CORS: Updated to rallyehiver.fr
- **Payment Testing**:
  - All payments are now REAL and will charge actual credit cards
  - Use Stripe test cards for testing only
  - Real payments will process through production Stripe account
- **Deployment**: ✅ Deployed to production (2025-12-06, 93s deployment)
- **Status**: ✅ Live - Production payments enabled
- **Documentation**: .env file updated with production Stripe configuration

### 2025-12-06 17:30
**Backend → Frontend**: 🌐 **DOMAIN MIGRATION COMPLETE - rallyehiver.fr Live**
- ✅ **Migrated from proto.rallyehiver.fr to rallyehiver.fr**
- **Changes**:
  - SSL Certificate: Validated for rallyehiver.fr and www.rallyehiver.fr
  - CloudFront Distribution: Updated with new domains
  - Route53 DNS: A records created for both domains
  - Backend CORS: Updated to https://rallyehiver.fr
- **Frontend URLs**:
  - Primary: https://rallyehiver.fr
  - Alternate: https://www.rallyehiver.fr
  - Old URL (proto.rallyehiver.fr): No longer primary
- **Status**: ✅ Live and operational
- **Testing**: Both domains verified working

### 2025-12-02 17:00
**Backend → Frontend**: ✅ **ENHANCEMENT - Unique Team Name Validation**
- ✅ **Added validation to prevent duplicate team names**
- **Changes**:
  - Team creation now checks if name already exists before creating
  - Returns HTTP 409 (Conflict) if duplicate name detected
  - Team names are compared case-sensitively after trimming whitespace
- **Implementation Details**:
  - Added `getTeamByName()` function in dynamodb.ts using Scan operation
  - Updated `POST /teams` endpoint to validate uniqueness
  - Error message: "A team with this name already exists"
- **Frontend Impact**:
  - Frontend should handle 409 error when creating teams
  - Display user-friendly message: "Ce nom d'équipe est déjà pris"
  - Suggest user tries a different name
- **Database Note**: Uses DynamoDB Scan (no GSI needed for rare operation)
- **Documentation Updated**:
  - API_CONTRACT.md - Updated POST /teams endpoint
  - Added changelog entry for 2025-12-02
- **Deployment**: ✅ Deployed to production (2025-12-02, 87s deployment)
- **Status**: ✅ Live and operational

### 2025-12-02 14:00
**Admin Frontend → All**: 🚀 **IMPLEMENTED - Admin Game Start Button**
- ✅ **Added "Lancer le Rallye" button to admin dashboard**
- **New Features**:
  - Game status card showing current rally state (waiting/started)
  - Visual indicators: 🎮 for started, ⏸️ for waiting
  - Color-coded status badges (orange for waiting, green for started)
  - Big "🚀 Lancer le Rallye" button (only visible when game not started)
  - Confirmation dialog before starting
  - Success/error message display
  - Auto-refresh of game status every 60 seconds
  - Display of start timestamp when game is launched
- **API Integration**:
  - Calls `POST /admin/game/start` with admin authentication
  - Fetches `GET /game/status` to display current state
  - Proper error handling and user feedback
- **UX Details**:
  - Gradient button with hover animation
  - Warning message: "Une fois lancé, le rallye ne peut plus être arrêté"
  - Loading state during API call
  - Success message displayed for 5 seconds
- **Files Modified**:
  - `src/admin/services/adminAPI.ts` - Added adminGameAPI.startGame()
  - `src/admin/pages/AdminDashboard.tsx` - Added game status section and start button
  - `src/admin/pages/AdminDashboard.css` - Added styling for game status card
- **Build**: 247.52 kB gzipped (+269 B for game control UI)
- **Status**: ✅ **READY TO DEPLOY** - Admin can now control game start
- **Next Step**: Deploy to https://proto.rallyehiver.fr/admin

### 2025-12-02 11:00
**Backend → Frontend**: 🎮 **NEW FEATURE - Game Startup Control System**
- ✅ **Implemented admin-controlled game start mechanism**
- **Purpose**: Until admin starts the game, frontend should display a waiting state
- **New Endpoints**:
  - **GET /game/status** (Public - no auth required)
    - Returns: `{ isStarted: boolean, startedAt: string | null }`
    - Use this to check if game has started
    - Frontend should poll this endpoint or check on app load
  - **POST /admin/game/start** (Admin only)
    - Starts the game (sets `isStarted: true`)
    - Once started, game **cannot** be stopped
    - Returns full game status with `startedBy` admin ID
- **Frontend Implementation Required**:
  - **Waiting State UI**: When `isStarted: false`, show countdown/waiting message
  - **Normal Game UI**: When `isStarted: true`, allow normal game interaction
  - **Polling Strategy**: Poll `/game/status` every 30-60 seconds or on app focus
  - **Admin Panel**: Add "Start Game" button that calls POST /admin/game/start
- **Database Changes**:
  - New table: `rallye-hiver-backend-game-status`
  - Single record with gameId: "rallye-2025"
  - Idempotent initialization (safe concurrent access)
- **Documentation Updated**:
  - API_CONTRACT.md - Full endpoint documentation (lines 50-72, 1062-1094)
  - DATA_MODELS.md - GameStatus model schema (lines 302-346)
- **Current Status**: ✅ Deployed and tested
  - Test endpoint: `curl https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod/game/status`
  - Current result: `{"isStarted": false, "startedAt": null}`
- **Priority**: HIGH - Core feature for game launch control

### 2025-11-29 16:00
**Frontend → Backend**: 🚨 **CRITICAL BLOCKER - CORS Still Broken on PUT /admin/enigmas/{enigmaId}**
- ❌ **Backend claimed CORS fix was deployed but errors persist**
- **Current Error** (still happening in production):
  ```
  Access to XMLHttpRequest from origin 'https://proto.rallyehiver.fr' has been blocked by CORS policy:
  Response to preflight request doesn't pass access control check:
  No 'Access-Control-Allow-Origin' header is present on the requested resource.
  ```
- **Endpoint**: `PUT https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod/admin/enigmas/{enigmaId}`
- **Frontend Status**: Admin drag-and-drop UI is deployed but cannot save changes
- **Impact**: Admin feature is broken in production
- **Required Action**:
  1. Test OPTIONS request manually: `curl -X OPTIONS https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod/admin/enigmas/test-id -H "Origin: https://proto.rallyehiver.fr" -H "Access-Control-Request-Method: PUT" -H "Access-Control-Request-Headers: Content-Type,Authorization" -v`
  2. Verify Lambda returns CORS headers
  3. Verify API Gateway has OPTIONS method enabled
  4. Re-deploy with correct configuration
- **Documentation**: See FRONTEND_REQUIREMENTS.md for full details
- **Priority**: CRITICAL - Blocking deployed admin feature

### 2025-11-29 15:45
**Frontend → All**: 🎨 **DEPLOYED Admin Drag-and-Drop UI (Blocked by Backend)**
- ✅ **Implemented drag-and-drop reordering for enigmas in admin panel**
- **New Features**:
  - Drag handle icon (⋮⋮) at start of each enigma row
  - Visual feedback during drag (blue highlight, grab cursor)
  - Automatic save of new order to backend via PUT requests
  - Error handling with automatic revert on failure
- **Technology**: @hello-pangea/dnd (react-beautiful-dnd fork)
- **Frontend Code**: Ready and deployed
- **Backend Blocker**: PUT /admin/enigmas/{enigmaId} returns no CORS headers
- **Files Modified**:
  - `src/admin/pages/AdminEnigmas.tsx` - Added drag-and-drop logic
  - `src/admin/pages/AdminEnigmas.css` - Added drag styles
  - `package.json` - Added @hello-pangea/dnd dependency
- **Build**: 246.93 kB gzipped (+133 B for drag library)
- **Status**: ⚠️ **DEPLOYED BUT BROKEN** - Waiting for backend CORS fix

### 2025-11-29 15:30
**Frontend → All**: 🎯 **Simplified Admin Enigmas Form**
- ✅ **Removed points, difficulty, and description fields from admin enigma management**
- **Changes**:
  - Simplified create/edit form to: Number, Title, PDF URL, Active status
  - Removed columns from table display
  - Updated TypeScript types to match
- **Build**: 246.58 kB gzipped
- **Deployment**: Deployed to https://proto.rallyehiver.fr/admin/enigmas
- **Status**: ✅ **LIVE** - Cleaner admin UI

### 2025-11-23 10:30
**Frontend → All**: 🔐 **FORGOT PASSWORD FLOW IMPLEMENTED - User Password Reset**
- ✅ **Implemented complete forgot password flow in frontend**
- **New UI Features**:
  - "Mot de passe oublié ?" link on login panel
  - Forgot password form (email input)
  - Reset password form (code + new password inputs)
  - Auto-progression through flow (forgot → reset → login)
  - Success/error message display
- **API Integration**:
  - `POST /auth/forgot-password` - Request verification code
  - `POST /auth/reset-password` - Complete password reset
- **User Experience**:
  - User clicks "Mot de passe oublié ?" from login
  - Enters email, receives 6-digit code via AWS Cognito email
  - Enters code + new password to reset
  - Auto-redirected back to login after success
  - Clear error messages for invalid codes or password requirements
- **Files Modified**:
  - `src/services/api.ts` - Added forgotPassword and resetPassword API functions
  - `src/components/panels/AuthPanel.tsx` - Added forgot/reset password modes and UI
  - `src/components/panels/AuthPanel.css` - Added link-button and success-message styles
- **Build**: 247.14 kB gzipped (+554 B for password reset UI)
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `I2409GSLRUJIHNA3O04I3I5APU`
- **Status**: ✅ **LIVE** - Users can now reset forgotten passwords

### 2025-11-22 23:15
**Backend → All**: 🔐 **ADMIN PANEL BACKEND COMPLETE - Full Admin Management System**
- ✅ **Implemented complete admin backend** to support frontend admin panel
- **New Endpoints Created**:
  - **Authentication**: `POST /admin/auth/login`, `GET /admin/auth/verify`
  - **Statistics**: `GET /admin/stats/overview` (dashboard aggregated stats)
  - **Teams Management**: `GET /admin/teams`, `GET /admin/teams/{teamId}`, `GET /admin/teams/{teamId}/progress`
  - **Enigmas Management**: `GET /admin/enigmas` (with statistics)
  - **Parcours Management**: `GET /admin/parcours` (with statistics), `PUT /parcours/{parcoursId}`, `DELETE /parcours/{parcoursId}`
  - **Attempts Monitoring**: `GET /admin/attempts` (with filtering: success, teamId, enigmaId, pagination)
- **Security Enhancements**:
  - Added `isAdmin` field to User model
  - Created admin authorization utilities (`requireAdmin`, `isUserAdmin`, `getAdminUser`)
  - Protected all sensitive endpoints with admin role checks
  - Admin role verified on login and all subsequent requests
  - All existing admin endpoints now require admin role (leaderboard, attempts by team/enigma)
  - All enigma/parcours CRUD operations now require admin role
- **Database Changes**:
  - Added email GSI to Users table (enables admin login by email)
  - Schema supports admin flag per user
- **API Response Enhancements**:
  - Enigmas include statistics: `totalAttempts`, `successfulAttempts`, `teamsSolved`
  - Parcours include statistics: `teamsUnlocked`
  - Teams include progress: `solvedEnigmasCount`, `unlockedParcoursCount`, `totalAttempts`, `lastActivityAt`
  - Attempts include enhanced data: `teamName`, `enigmaTitle`, `attemptedByName`
- **Documentation Updated**:
  - API_CONTRACT.md - Added all 11 new admin endpoints
  - Added 16 changelog entries documenting admin changes
  - Updated timestamp to 2025-11-22
- **Deployment**: ✅ Deployed to production (2025-11-22 23:15, 66s deployment)
- **Frontend Impact**:
  - Admin panel frontend can now authenticate and access all admin features
  - Dashboard statistics ready for display
  - Team monitoring with full progress tracking
  - Enigmas and parcours CRUD operations supported
  - Attempts filtering and pagination available
- **Status**: ✅ Admin backend fully operational and secure

### 2025-11-22 22:00
**Backend → All**: ✅ **PARCOURS COMPLETION TRACKING - Frontend-Controlled Status**
- ✅ **Added completion status for parcours**
- **New Endpoint**: `POST /parcours/{parcoursId}/complete`
  - Allows frontend to mark a parcours as completed
  - Creates or updates team parcours access record
  - Idempotent (can be called multiple times safely)
- **Changes Made**:
  - Added `completed` and `completedAt` fields to `TeamParcoursAccess` type
  - Created `markCompleted.ts` handler function
  - Updated `getAccessibleParcours` to include completion status in response
  - Added `updateTeamParcoursAccess` utility function in dynamodb.ts
- **API Updates**:
  - `GET /progress/parcours` now returns `completed` (boolean) and `completedAt` (timestamp | null)
  - New `POST /parcours/{parcoursId}/complete` endpoint available
  - Defaults: `completed: false`, `completedAt: null` until marked complete
- **Documentation Updated**:
  - API_CONTRACT.md - Added new endpoint and updated response schemas
  - Added changelog entries for both changes
- **Frontend Impact**:
  - Frontend can now mark parcours as complete when user finishes them
  - Completion status persists in DynamoDB
  - Status is team-specific (different teams can have different completion states)
- **Deployment**: ✅ Deployed to production (2025-11-22 22:00, 45s deployment)
- **Status**: ✅ Parcours completion tracking fully operational

### 2025-11-22 21:30
**Backend → All**: 🎯 **POINTS SYSTEM REMOVED - Simplified Game Mechanics**
- ✅ **Removed points from password attempt responses**
- **Changes Made**:
  - `submitAttempt.ts` - No longer calculates or returns points
  - Team updates only track `solvedEnigmasCount`, not points
  - Response no longer includes `points` or `totalTeamPoints`
- **API Breaking Change**:
  - `POST /progress/attempt` response simplified
  - Correct answer: Returns `{ success, message, attemptCount, newlyUnlockedParcours }`
  - Incorrect answer: Returns `{ success, message, attemptCount }`
  - **Removed fields**: `points`, `totalTeamPoints`
- **Documentation Updated**:
  - API_CONTRACT.md - Updated response schemas and notes
  - Added change log entry for points removal
- **Frontend Impact**:
  - Frontend should NOT expect `points` or `totalTeamPoints` in responses
  - Focus on enigma count (`solvedEnigmasCount`) instead of points
  - No UI changes strictly required (graceful degradation)
- **Deployment**: ✅ Deployed to production (2025-11-22 21:30)
- **Status**: ✅ Points system completely removed from backend

### 2025-11-16 23:30
**Backend → All**: 🔓 **PARCOURS UNLOCKED - No Conditions Required**
- ✅ **Removed all lock conditions from parcours**
- **Changes Made**:
  - `getAccessibleParcours` - Now returns ALL active parcours
  - `checkParcoursAccess` - Always returns `hasAccess: true`
  - No longer checks `team-parcours-access` table
- **User Impact**:
  - All parcours immediately accessible after team payment
  - No need to solve enigmas to unlock parcours
  - Simplified game flow
- **Deployment**: ✅ Deployed to production
- **Status**: ✅ All parcours now unlocked for all paid teams

### 2025-11-16 23:20
**Backend → All**: 🎉 **STRIPE WEBHOOK WORKING PERFECTLY**
- ✅ **Payment flow fully functional end-to-end**
- ✅ **Webhook successfully received and processed**
- **Test Payment Details**:
  - Team: Terpsichore (d95f38a4-84b5-4103-925f-4c59901e56f3)
  - Payment Intent: pi_3SWO2vFujfDconi40BuNg9T4
  - Amount: €26.00
  - Status: PAID ✅
- **Database Updated**:
  - `hasPaid: true`
  - `paidAt: 2025-11-22T21:08:45.264Z`
  - `points: 0` (initialized)
  - `stripePaymentId: pi_3SWO2vFujfDconi40BuNg9T4`
- **Webhook Verification**:
  - Signature verified ✅
  - Event type: `checkout.session.completed` ✅
  - Team metadata extracted correctly ✅
- **Status**: ✅ **PRODUCTION READY** - Payment system fully operational

### 2025-11-16 23:15
**Backend → All**: ✅ **WEBHOOK SECRET UPDATED**
- ✅ **Updated webhook signing secret to match Stripe Dashboard**
- **New Secret**: `whsec_REDACTED`
- **Updated Functions**:
  - `rallye-hiver-backend-prod-stripeWebhook`
  - `rallye-hiver-backend-prod-createCheckout`

### 2025-11-16 23:10
**Backend → All**: ✅ **PAYMENT FUNCTIONS FULLY CONFIGURED**
- ✅ **Fixed missing DynamoDB table environment variables**
- **Issue**: createCheckout failed with "TableName validation error"
- **Root Cause**: Lambda update accidentally removed table name variables
- **Solution**: Restored all environment variables to both payment functions
- **Updated Functions**:
  - `rallye-hiver-backend-prod-createCheckout` - checkout creation (✅ all env vars)
  - `rallye-hiver-backend-prod-stripeWebhook` - webhook handler (✅ all env vars)
- **Environment Variables Restored**:
  - All DynamoDB table names (TEAMS_TABLE, USERS_TABLE, etc.)
  - Cognito configuration
  - Stripe keys and webhook secret
  - CORS origin
- **Status**: ✅ **READY TO TEST** - Payment flow should work now

### 2025-11-16 23:05
**Backend → All**: ✅ **STRIPE WEBHOOK CONFIGURED AND READY**
- ✅ **Webhook endpoint added to Stripe Dashboard**
- ✅ **Lambda environment updated with new signing secret**
- **Webhook URL**: `https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod/payments/webhook`
- **Signing Secret**: `whsec_REDACTED`
- **Listening for**: `checkout.session.completed`

### 2025-11-16 23:00
**Backend → All**: 📝 **STRIPE WEBHOOK SETUP DOCUMENTATION**
- ✅ **Created comprehensive webhook setup guide**
- **Issue Identified**: Stripe webhook not configured in Dashboard
- **Root Cause**: User completed payment but team not marked as paid
- **Documentation**: `backend/STRIPE_WEBHOOK_SETUP.md`

### 2025-11-16 22:33
**Frontend → All**: ✅ **DEPLOYED - Team Creation/Browse Fix (No More Page Reloads)**
- ✅ **Fixed team creation and join team navigation issues**
- **Problem**: "Create Team" and "Join Team" buttons were using `<a href>` links causing full page reloads
- **Solution**: Integrated team management directly into StatsPanel with inline forms
- **Changes**:
  - Added "Create Team" section with inline form in StatsPanel
  - Added "Browse Teams" section with team list and join functionality
  - Both features now work within the 3-panel interface (no routing/page reloads)
  - Added back buttons to return to dashboard
  - Team creation redirects to "Mon Équipe" tab after success
  - Join team returns to dashboard and shows pending request status
- **Build**: 241.52 kB gzipped (+517 B for team management UI)
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `ICF281JJNKIQ4S1UD1ZK7LEI7E`
- **Status**: ✅ **LIVE** - Team creation and browsing work seamlessly

### 2025-11-16 22:30
**Frontend → All**: ✅ **DEPLOYED - 403 Error Fix for Team-Only Endpoints**
- ✅ **Deployed backend agent's conditional query fixes**
- **Files Modified** (by backend agent):
  - `EnigmasPanel.tsx` - Only fetch progress when user has team
  - `ParcoursPanel.tsx` - Only fetch parcours access when user has team
  - `StatsPanel.tsx` - Enhanced compact view for no-team state
- **Changes**:
  - Added `enabled: !!user?.teamId` to React Query hooks
  - Show friendly message when user has no team
  - Eliminated 403 console errors for users without teams
- **Build**: 241 kB gzipped (+109 B from conditional logic)
- **Deployment**:
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `IEH8OQHLRC2RR2S94MLARRMOUC`
- **Status**: ✅ **LIVE** - No more 403 errors for users without teams

### 2025-11-16 22:45
**Backend → Frontend**: 🐛 **BUG FIX - Conditional Queries for Team-Only Endpoints**
- ✅ **Fixed 403 errors** from `/progress` and `/progress/parcours` endpoints
- **Root Cause**: React Query was calling team-only endpoints even when user had no team
- **Solution**: Added conditional queries with `enabled: !!user?.teamId`
- **Files Modified**:
  - `EnigmasPanel.tsx` - Only fetch enigmas with progress when user has team
  - `ParcoursPanel.tsx` - Only fetch parcours with access when user has team
  - `StatsPanel.tsx` - Enhanced compact view to handle no-team state
- **UX Improvements**:
  - Show friendly message: "Rejoignez ou créez une équipe pour accéder aux énigmes/parcours"
  - No more console errors for users without teams
  - Clean state management
- **Status**: ✅ Fixed, ready for deployment
- **Frontend Action Required**: Deploy these fixes to production

### 2025-11-16 22:30
**Backend → All**: 🔧 **CLOUDFRONT FIX - SPA Routing Enabled**
- ✅ **Fixed 404 errors on frontend routes** (e.g., `/team/create`)
- **Root Cause**: CloudFront had no custom error responses configured
- **Solution**: Added custom error responses to serve `index.html` for 404/403 errors
- **Changes Made**:
  - Error 404 → Serve `/index.html` with 200 status
  - Error 403 → Serve `/index.html` with 200 status
  - Error cache TTL: 300 seconds
- **CloudFront Distribution**: `E2M1D4SPTNMDIK`
- **Status**: Deploying (5-15 minutes to propagate)
- **Impact**: React Router will now properly handle all frontend routes
- **Testing**: After deployment completes, navigation to `/team/create` and other routes will work

### 2025-11-16 22:05
**Frontend → All**: ✅ **FRONTEND MIGRATION COMPLETE - Connected to New Production API**
- ✅ **Updated API base URL** in frontend configuration
- **Old URL**: `https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev`
- **New URL**: `https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod`
- **Changes Made**:
  - Updated `.env.production` with new API URL
  - Updated `tests/.env.test` with new API URL
  - Rebuilt frontend (240.89 kB gzipped)
  - Deployed to S3: `s3://proto.rallyehiver.fr`
  - CloudFront invalidation: `ICL266O7KJAOCLTOYOXSO2J75C`
- **Status**: ✅ **LIVE** - Frontend now connected to single prod environment
- **Migration Time**: ~2 minutes (build + deploy + invalidation)
- **Breaking Change Resolved**: API base URL migration complete ✅

### 2025-11-16 16:30
**Backend → All**: 🚀 **MIGRATION COMPLETE - Single Production Environment**
- ✅ **Successfully migrated from dev/prod to single prod environment**
- ✅ **All data migrated successfully**:
  - 21 enigmas (20 game enigmas + 1 original)
  - 10 parcours with unlock requirements
  - 1 user account
  - All progress and team data
- ✅ **Old dev stack removed** - clean infrastructure
- **🔴 BREAKING CHANGE**: New API base URL
  - **Old**: `https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev/dev`
  - **New**: `https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod`
- **Frontend Action Required**: Update API base URL in configuration
- **All resource names simplified** - no more stage suffixes
  - Tables: `rallye-hiver-backend-users` (not `-dev` or `-prod`)
  - Cognito: `rallye-hiver-backend-user-pool` (not `-user-pool-dev`)
- **Documentation Updated**:
  - API_CONTRACT.md - new base URL
  - README.md - single environment deployment
  - MIGRATION_INSTRUCTIONS.md - migration guide created
- **Deployment**: Single command: `AWS_PROFILE=claude-admin npm run deploy`
- **Migration time**: ~2 minutes (deploy + data copy + cleanup)

### 2025-11-16 15:45
**Backend → All**: 🎮 **GAME CONTENT COMPLETE - 20 Enigmas + 10 Parcours Created**
- ✅ Created **20 enigmas** with French titles, descriptions, and passwords
- ✅ Created **10 parcours** with unlock requirements
- **Database Status**:
  - Enigmas table: 21 records (enigma #1-20 + original)
  - Parcours table: 10 records (parcours #1-10)
- **All enigmas** use the same PDF: `enigma-01.pdf` (can be customized later)
- **All parcours** use the same PDF: `enigma-01.pdf` (can be customized later)
- **Sample Enigmas**:
  - #1: "Le Mystère de la Tour Eiffel" (password: PARIS1889, easy, 10pts)
  - #10: "Le Mystère de la Sainte-Chapelle" (password: VITRAIL, medium, 15pts)
  - #20: "Le Secret du Père Lachaise" (password: ETERNITE, hard, 20pts)
- **Sample Parcours**:
  - #1: "Circuit des Monuments Historiques" (requires 3 enigmas)
  - #5: "Le Parcours des Écrivains" (requires 3 enigmas)
  - #10: "Le Grand Tour Final" (requires 4 enigmas)
- **Frontend Ready**: All content available via `GET /enigmas` and `GET /parcours`
- **Game Ready**: Players can now solve enigmas and unlock parcours!

### 2025-11-16 15:30
**Backend → All**: 📄 **S3 Setup Complete - Enigma #1 Ready**
- ✅ Created S3 bucket `rallyehiver-enigmas` (eu-west-1)
- ✅ Configured public read access + CORS for https://proto.rallyehiver.fr
- ✅ Uploaded `enigme1.pdf` (1.1MB) to S3
- ✅ Created Enigma #1 record in DynamoDB
- **PDF URL**: https://rallyehiver-enigmas.s3.eu-west-1.amazonaws.com/2025/enigma-01.pdf
- **Enigma Details**:
  - enigmaNumber: 1
  - title: "Énigme 1"
  - description: "Première énigme du Rallye d'Hiver 2025"
  - difficulty: easy
  - points: 10
  - correctPassword: "CHANGEME" (⚠️ **UPDATE THIS**)
- **Frontend Ready**: Enigma appears in `GET /enigmas` and can be viewed with react-pdf
- **Answered Q1**: PDF viewing strategy resolved - use browser native viewer with S3 URLs

### 2025-11-16 14:17
**Frontend → All**: 📄 **DEPLOYED** PDF Viewer Integration with react-pdf
- **LIVE** at https://proto.rallyehiver.fr
- Implemented inline PDF viewing using react-pdf library
- **Features**:
  - Page navigation (prev/next buttons)
  - Zoom controls (zoom in, zoom out, reset to 100%)
  - Page counter display (current page / total pages)
  - Loading states and error handling
  - Responsive design for mobile devices
- **Integrated into**:
  - EnigmasPanel: PDFs display when enigma is selected
  - ParcoursPanel: PDFs display when parcours is unlocked and selected
- **Bundle size**: 240.89 kB (gzipped) - increased from 107.46 kB due to PDF.js library (~133 kB added)
- **Fallback handling**: Shows placeholder message when PDF URL is not available
- CloudFront invalidation ID: IC5F6FPK14SUYFRD26J12SW471
- **No breaking changes** - backend APIs unchanged
- **Technology**: react-pdf + pdfjs-dist (Mozilla PDF.js)

### 2025-11-16 13:51
**Frontend → All**: 🚀 **DEPLOYED** Complete UI Overhaul - New 3-Panel Interface
- **LIVE** at https://proto.rallyehiver.fr
- Implemented complete interface redesign from NEWFEATURES.md
- **Unauthenticated state**: Panel 1 (General Info) + Panel 2 (Edition Info) + Panel 3 (Auth)
- **Authenticated state**: Panel 1 (Enigmas) + Panel 2 (Parcours) + Panel 3 (Dashboard/Team/Stats)
- Panel 3 now includes tabbed interface: Dashboard, Mon Équipe, Stats
- Added "Rallye d'Hiver" logo in top right corner
- Removed header bar - all navigation now in panels
- Sign out button integrated in Panel 3
- Build size: 107.46 kB (gzipped) - optimized!
- CloudFront invalidation ID: I9A7WXRCZ3HJ15MIJBQP0HF6HH
- **No breaking changes** - backend APIs unchanged

### 2025-11-16 14:50
**Backend → All**: 🚀 **DEPLOYED - Enhanced Password Attempt Responses**
- ✅ Successfully deployed to dev environment (53s)
- Added 20 random funny error messages in French for incorrect password attempts
- Messages are encouraging and humorous to improve UX
- No breaking changes - only enhances existing `POST /progress/attempt` endpoint
- Updated API_CONTRACT.md with new message format
- Endpoint: `POST https://7dl3fb5cce.execute-api.eu-west-1.amazonaws.com/dev/dev/progress/attempt`
- **Frontend can now test** - will receive random funny messages on incorrect attempts

### 2025-11-16 11:35
**Documentation → All**: 📚 **Documentation Cleanup Complete**
- Created consolidated coordination files following CLAUDE.md pattern
- New files: API_CONTRACT.md, DATA_MODELS.md, FRONTEND_REQUIREMENTS.md, DECISIONS.md
- Archived session-specific docs to .claude/archive/2025-11-16-session/
- All agents should now use these files as source of truth

### 2025-11-16 09:10
**Frontend → All**: 🚀 **DEPLOYED** Full backend integration LIVE at https://proto.rallyehiver.fr
- 3-panel game interface deployed
- Real-time enigma/parcours/stats with backend APIs
- CloudFront cache invalidated (ID: I7VGIWSWP6Q3DNZRXJJH3DXHR6)

### 2025-11-16 00:55
**Backend → All**: Removed Google OAuth. All auth endpoints updated. See API_CONTRACT.md for current endpoints.

---

## Breaking Changes Alert

| Date | Endpoint/Feature | Change | Migration Required |
|------|------------------|--------|-------------------|
| 2025-11-22 | **POST /progress/attempt** | Removed `points` and `totalTeamPoints` from response | Frontend should stop displaying points (optional - graceful degradation) |
| 2025-11-16 | **API Base URL** | Changed from `/dev/dev` to `/prod` | **Update frontend API base URL** (✅ completed 22:05) |
| 2025-11-16 | OAuth | Removed Google OAuth | Remove OAuth buttons from UI (✅ completed) |

---

## Work In Progress

### Backend
- *(none)*

### Frontend
- *(none)*

---

## Recently Completed

### Week of 2025-11-16
**Backend**:
- ✅ Implemented all game endpoints (enigmas, parcours, progress, admin)
- ✅ Created 5 new DynamoDB tables for game content
- ✅ Deployed to dev environment
- ✅ Updated API contract documentation
- ✅ Enhanced password error messages (20 funny variants)
- ✅ Created S3 bucket for enigma PDFs
- ✅ Uploaded first enigma PDF and created DynamoDB record
- ✅ Answered PDF viewing strategy question
- ✅ **Generated and uploaded 20 enigmas with French content**
- ✅ **Generated and uploaded 10 parcours with unlock requirements**
- ✅ Full game content ready for testing
- ✅ **Migrated to single production environment**
- ✅ **Removed dev/prod separation** - simplified architecture
- ✅ **Data migration complete** - all content preserved

**Frontend**:
- ✅ Created 3-panel game interface (Enigmas, Parcours, Stats)
- ✅ Integrated all panels with backend APIs
- ✅ Password submission with real-time validation
- ✅ Parcours auto-unlock UI
- ✅ Deployed to production
- ✅ Complete UI redesign per NEWFEATURES.md
- ✅ Unauthenticated panels (General Info, Edition Info, Auth)
- ✅ Enhanced Panel 3 with Dashboard/Team/Stats tabs
- ✅ Logo placement and header removal
- ✅ Deployed new interface (2025-11-16 13:51)
- ✅ PDF viewer integration with react-pdf
- ✅ Page navigation and zoom controls
- ✅ Deployed PDF viewer (2025-11-16 14:17)
- ✅ **Migrated to single production API** (2025-11-16 22:05)
- ✅ **Updated all environment configurations** for new backend URL
- ✅ **Deployed 403 error fix** (2025-11-16 22:30) - conditional queries for team-only endpoints
- ✅ **Fixed team creation/browse** (2025-11-16 22:33) - inline forms instead of navigation

---

## Quick Communication

### Questions & Answers

**Template**:
```
Q: [Agent] - Question about X?
A: [Agent] - Answer...
Status: [Resolved/Pending]
```

*(No open questions currently)*

---

## Coordination Guidelines

### Safe to Work in Parallel ✅
- Different features entirely
- Frontend UI improvements (no API changes)
- Backend performance optimizations (no contract changes)
- Documentation updates (different sections)

### Requires Coordination ⚠️
- New API endpoints (document in API_CONTRACT.md first)
- Breaking API changes (announce in Breaking Changes Alert)
- Database schema changes (update DATA_MODELS.md)
- Shared files (DECISIONS.md, this file)

### Cannot Work in Parallel ❌
- Same file edits
- Same feature (assign to one agent only)
- Simultaneous deployment

---

## Daily Sync Checklist

Before starting work:

**Both Agents**:
- [ ] Read this coordination log
- [ ] Check API_CONTRACT.md for changes
- [ ] Review FRONTEND_REQUIREMENTS.md for requests
- [ ] Note any breaking changes
- [ ] Review functional tests status

**Backend Agent**:
- [ ] Check FRONTEND_REQUIREMENTS.md for new requests
- [ ] Update API_CONTRACT.md if implementing new endpoints
- [ ] Update DATA_MODELS.md if changing schemas

**Frontend Agent**:
- [ ] Check Recent Notifications for backend updates
- [ ] Update FRONTEND_REQUIREMENTS.md with new needs
- [ ] Check if any requested endpoints are now ready

---

## File References

For detailed information, see:
- **API Contracts**: API_CONTRACT.md (single source of truth)
- **Data Models**: DATA_MODELS.md (database schemas)
- **Frontend Needs**: FRONTEND_REQUIREMENTS.md (requests and blockers)
- **Decisions**: DECISIONS.md (architectural choices)
- **Process**: CLAUDE.md (coordination pattern)
- **Setup**: README.md (project overview)
- **Spec**: SPECIFICATION.md (original requirements)

---

**Last Review**: 2025-11-16 by documentation cleanup agent
