# Frontend Requirements & Blockers

**Last updated by**: frontend user agent
**Last updated**: 2025-12-20

---

## Overview

This document tracks frontend requirements, blockers, and questions that affect the backend. Backend agent should review this file regularly to understand frontend needs.

---

## Current Status

### Implemented Features
- ✅ User authentication flow (signup, login, token management)
- ✅ Team creation and management
- ✅ Team join request workflow
- ✅ Payment integration (Stripe Checkout)
- ✅ 3-panel game interface (Enigmas, Parcours, Stats)
- ✅ Real-time enigma fetching with progress tracking
- ✅ Password submission with backend validation
- ✅ Parcours auto-unlocking based on solved enigmas
- ✅ Live team stats updates
- ✅ Admin panel with full CRUD for enigmas and parcours
- ✅ Admin drag-and-drop reordering for enigmas
- ✅ **Beta team early access system** - Teams marked as beta can access game before official launch
- ✅ **DEPLOYED** to production at https://rallyehiver.fr

### In Progress
- None currently

---

## Blockers

### High Priority

*No current blockers*

### Medium Priority

**⚠️ Admin Overview Dashboard - Optimized Endpoint Needed** (Requested 2025-12-20)
- **Feature**: New admin overview dashboard with team progress visualization
- **Current State**: Frontend implemented and deployed at `/admin/overview`
- **Issue**: Currently makes N+1 queries (one per team) to fetch progress
- **Request**: Create optimized endpoint `GET /admin/teams/overview`
- **Expected Response**:
  ```json
  {
    "teams": [
      {
        "teamId": "uuid",
        "teamName": "string",
        "hasPaid": boolean,
        "memberCount": number,
        "lastActivityAt": "ISO 8601 timestamp | null",
        "solvedEnigmas": ["enigmaId1", "enigmaId2", ...], // Array of solved enigma IDs
        "unlockedParcours": ["parcoursId1", "parcoursId2", ...] // Array of unlocked parcours IDs
      }
    ]
  }
  ```
- **Use Case**:
  - Admin dashboard shows timeline chart of attempts (last 28 days)
  - Admin dashboard shows grid of all teams with visual progress (20 enigmas + 10 parcours)
  - Green boxes for solved/unlocked, neutral for unsolved
  - Gray out teams with no activity in 7+ days
- **Performance**: With 55 teams, current implementation makes 55+ API calls
- **Priority**: Medium (works but slow - would benefit from optimization)

### Low Priority

*No current blockers*

---

## Recent Backend Updates

### 🔄 Password Attempts Timeline API - Updated to Daily Buckets (2026-01-02)

**Endpoint**: `GET /admin/stats/password-attempts-timeline`

**BREAKING CHANGE**: The API response format has been updated from hourly to daily buckets.

#### What Changed

**Before** (48 hours, hourly buckets):
```json
{
  "timeline": [
    {
      "hour": "2025-12-21 14:00",
      "timestamp": "2025-12-21T14:00:00.000Z",
      "correctAttempts": 5,
      "incorrectAttempts": 12,
      "totalAttempts": 17
    }
  ],
  "summary": {
    "hoursIncluded": 48,
    "periodStart": "...",
    "periodEnd": "..."
  }
}
```

**After** (30 days, daily buckets):
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
    }
  ],
  "summary": {
    "daysIncluded": 30,
    "periodStart": "...",
    "periodEnd": "..."
  }
}
```

#### Frontend Changes Required

**1. Update Timeline Item Type**:
```typescript
// Before
interface TimelineItem {
  hour: string;              // "2025-12-21 14:00"
  timestamp: string;
  correctAttempts: number;
  incorrectAttempts: number;
  totalAttempts: number;
}

// After
interface TimelineItem {
  day: string;               // "2025-12-03" (NEW)
  timestamp: string;
  correctAttempts: number;
  incorrectAttempts: number;
  totalAttempts: number;
  successRate: number;       // NEW - daily success rate percentage
}
```

**2. Update Summary Type**:
```typescript
// Before
interface Summary {
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  successRate: number;
  periodStart: string;
  periodEnd: string;
  hoursIncluded: number;     // OLD
}

// After
interface Summary {
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  successRate: number;
  periodStart: string;
  periodEnd: string;
  daysIncluded: number;      // NEW - always 30
}
```

**3. Update Chart Configuration**:

If you're using a charting library (e.g., Chart.js, Recharts, D3), update:

```typescript
// Before - X-axis labels (hours)
const labels = timeline.map(item => item.hour);
// Example: ["2025-12-21 14:00", "2025-12-21 15:00", ...]

// After - X-axis labels (days)
const labels = timeline.map(item => item.day);
// Example: ["2025-12-03", "2025-12-04", ...]

// OR format for better readability:
const labels = timeline.map(item => {
  const date = new Date(item.timestamp);
  return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
});
// Example: ["3 déc.", "4 déc.", ...]
```

**4. Update Chart Data**:
```typescript
// Chart datasets can stay mostly the same
const chartData = {
  labels: timeline.map(item => item.day),
  datasets: [
    {
      label: 'Tentatives correctes',
      data: timeline.map(item => item.correctAttempts),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
    },
    {
      label: 'Tentatives incorrectes',
      data: timeline.map(item => item.incorrectAttempts),
      backgroundColor: 'rgba(255, 99, 132, 0.6)',
    },
  ],
};
```

**5. Optional: Display Daily Success Rate**:
```typescript
// NEW - You can now show daily success rate
const successRateData = {
  labels: timeline.map(item => item.day),
  datasets: [
    {
      label: 'Taux de réussite quotidien (%)',
      data: timeline.map(item => item.successRate),
      borderColor: 'rgba(54, 162, 235, 1)',
      type: 'line', // Line chart for success rate trend
    },
  ],
};
```

#### Migration Checklist

- [ ] Update TypeScript interfaces for `TimelineItem` and `Summary`
- [ ] Change `.hour` references to `.day` in chart label mapping
- [ ] Update `hoursIncluded` to `daysIncluded` in summary display
- [ ] Test chart rendering with new 30-day data (more data points)
- [ ] Consider adjusting chart width/responsiveness for 30 data points vs 48
- [ ] Optional: Add daily success rate visualization
- [ ] Update any hardcoded references to "48 hours" → "30 days"
- [ ] Update UI labels: "Dernières 48h" → "30 derniers jours"

#### Benefits of New Format

1. **Longer historical view**: 30 days vs 48 hours
2. **Better trend analysis**: Daily patterns easier to identify
3. **New metric**: Daily success rate included per day
4. **Same performance**: Single DynamoDB scan, ~100-300ms response time
5. **All days included**: Even days with 0 attempts are present (good for charts)

#### Example Frontend Code (AdminOverview.tsx)

```typescript
// Fetch timeline data
const { data: timelineData } = useQuery({
  queryKey: ['admin', 'password-attempts-timeline'],
  queryFn: async () => {
    const response = await adminAPI.getPasswordAttemptsTimeline();
    return response.data;
  },
});

// Render chart
const chartConfig = {
  labels: timelineData?.timeline.map(item => {
    const date = new Date(item.timestamp);
    return date.toLocaleDateString('fr-FR', {
      month: 'short',
      day: 'numeric'
    });
  }),
  datasets: [
    {
      label: 'Tentatives correctes',
      data: timelineData?.timeline.map(item => item.correctAttempts),
      backgroundColor: '#4ade80',
    },
    {
      label: 'Tentatives incorrectes',
      data: timelineData?.timeline.map(item => item.incorrectAttempts),
      backgroundColor: '#f87171',
    },
  ],
};

// Display summary
<div className="summary">
  <p>Période: {timelineData?.summary.daysIncluded} jours</p>
  <p>Total tentatives: {timelineData?.summary.totalAttempts}</p>
  <p>Taux de réussite: {timelineData?.summary.successRate}%</p>
</div>
```

---

## Recently Resolved Blockers

**✅ CRITICAL: Beta Team Access - React Query Cache Issue** (Resolved 2025-12-20 14:38)
- **Issue**: Beta teams (like "Les Orcades") could not access the game before official launch
- **Root Cause**: React Query was caching game status response from BEFORE user logged in
- **The Problem in Detail**:
  - Backend correctly parses JWT token from Authorization header
  - Backend identifies beta teams via `isBetaTeam: true` flag
  - Backend returns `{ isStarted: true }` for beta team members when authenticated
  - Backend returns `{ isStarted: false }` for all other users
- **What Frontend Must Do**:

  1. **Ensure Authentication Token is Sent**:
     ```typescript
     // ✅ CORRECT (already fixed in api.ts)
     const response = await api.get('/game/status'); // Uses interceptor with auth token

     // ❌ WRONG
     const response = await axios.get(`${API_URL}/game/status`); // No auth token
     ```

  2. **Check Game Status on Every Page Load/Route Change**:
     ```typescript
     // The frontend should call gameAPI.getStatus() when:
     // - App initializes
     // - User logs in
     // - User navigates to protected routes
     // - Every N seconds (optional polling)
     ```

  3. **Don't Cache Game Status Too Aggressively**:
     ```typescript
     // BAD: Caching game status for hours
     // GOOD: Check on every navigation or poll every 30-60 seconds
     ```

  4. **Respect the `isStarted` Flag**:
     ```typescript
     const { isStarted } = await gameAPI.getStatus();

     if (isStarted) {
       // Show full game interface (enigmas, parcours, etc.)
       return <GameInterface />;
     } else {
       // Show waiting screen
       return <WaitingScreen />;
     }
     ```

- **Expected Behavior After Fix**:
  - ✅ User in "Les Orcades" logs in → `GET /game/status` with token → Returns `isStarted: true` → Game accessible
  - ✅ User in other teams logs in → `GET /game/status` with token → Returns `isStarted: false` → Waiting screen
  - ✅ Unauthenticated user → `GET /game/status` no token → Returns `isStarted: false` → Waiting screen

- **How to Debug**:
  1. Open browser DevTools (F12) → Network tab
  2. Refresh the page after logging in
  3. Find request to `/game/status`
  4. **Check Request Headers**: Should have `Authorization: Bearer <long_token>`
  5. **Check Response**: Should be `{"isStarted": true, "startedAt": "..."}`
  6. If response is `isStarted: false` but headers are present, check CloudWatch logs (backend issue)
  7. If headers are missing, check that `api.get()` is used (not `axios.get()`)

- **Backend Logs Available**:
  - CloudWatch: `/aws/lambda/rallye-hiver-backend-prod-getGameStatus`
  - Logs show: userId, teamId, teamName, isBetaTeam flag, decision
  - Contact backend agent if logs show unexpected behavior

- **Files to Check/Modify**:
  - `src/services/api.ts` - Ensure `gameAPI.getStatus()` uses `api` instance ✅ (already fixed)
  - `src/App.tsx` or routing logic - Ensure game status is checked properly
  - `src/pages/*` - Ensure protected routes respect `isStarted` flag
  - State management (Redux/Context) - Ensure game status is not stale

- **Priority**: 🔴 **CRITICAL** - Blocking beta testing before official game launch
- **Backend Ready**: ✅ YES (deployed and tested)
- **Frontend Status**: ❓ Investigation needed

### Medium Priority

*No current blockers*

### Low Priority

*No current blockers*

---

## Technical Implementation Guide for Beta Team Access

### Backend Contract (DEPLOYED and READY)

**Endpoint**: `GET /game/status`
- **Authentication**: Optional (works with or without token)
- **Authorization Header**: `Authorization: Bearer <jwt_token>` (if user is logged in)

**Response When User is in Beta Team**:
```json
{
  "isStarted": true,
  "startedAt": "2025-12-20T15:15:00.000Z"
}
```

**Response for All Other Cases**:
```json
{
  "isStarted": false,
  "startedAt": null
}
```

### Backend Logic (For Understanding)

```typescript
// Simplified backend logic
async function checkGameStatus(authToken?) {
  if (authToken) {
    // Parse JWT, get user, check team
    const user = getUserFromToken(authToken);
    const team = getTeam(user.teamId);

    if (team.isBetaTeam === true) {
      return { isStarted: true, startedAt: now() }; // BETA ACCESS!
    }
  }

  // Default: return real game status
  const gameStatus = getGameStatus(); // Currently: { isStarted: false }
  return gameStatus;
}
```

### Current Beta Teams Configuration

- **Team**: "Les Orcades" (teamId: `0a699853-9809-4420-8fd7-55beaf51f95f`)
- **Flag**: `isBetaTeam: true`
- **Members**: 5 users including parisot.simon@gmail.com

### Frontend Implementation Checklist

- [ ] **Step 1**: Verify `gameAPI.getStatus()` uses `api.get('/game/status')` ✅ (DONE)
- [ ] **Step 2**: Check where game status is fetched in the app
- [ ] **Step 3**: Ensure game status is re-fetched after login
- [ ] **Step 4**: Check if game status is cached and clear cache
- [ ] **Step 5**: Verify routing logic respects `isStarted` flag
- [ ] **Step 6**: Test with browser DevTools Network tab
- [ ] **Step 7**: Verify Authorization header is present in request
- [ ] **Step 8**: Deploy and test on production

### Common Frontend Issues to Check

1. **Stale Cache**: Game status fetched once and never refreshed
   ```typescript
   // BAD
   const gameStatus = localStorage.getItem('gameStatus'); // Cached forever!

   // GOOD
   const gameStatus = await gameAPI.getStatus(); // Fresh every time
   ```

2. **Status Not Re-fetched After Login**:
   ```typescript
   // GOOD - Fetch game status after successful login
   async function handleLogin(email, password) {
     const { accessToken } = await authAPI.login(email, password);
     localStorage.setItem('accessToken', accessToken);

     // IMPORTANT: Fetch game status with new token
     const gameStatus = await gameAPI.getStatus();
     setGameStatus(gameStatus);
   }
   ```

3. **Conditional Rendering Not Working**:
   ```typescript
   // Check the routing/rendering logic
   function App() {
     const [gameStatus, setGameStatus] = useState(null);

     useEffect(() => {
       gameAPI.getStatus().then(setGameStatus);
     }, []); // ⚠️ Only runs once! Should re-run after login

     if (!gameStatus?.isStarted) {
       return <WaitingScreen />;
     }

     return <GameInterface />;
   }
   ```

### Testing Instructions for Frontend Agent

1. **Clear Browser Cache** (important!)
2. **Open DevTools** (F12) → Network tab
3. **Log out** and **log back in** as parisot.simon@gmail.com
4. **Watch for** `/game/status` request
5. **Verify Request Headers** include `Authorization: Bearer ...`
6. **Verify Response** is `{"isStarted": true, ...}`
7. **If isStarted is true** but game not showing → routing/rendering issue
8. **If isStarted is false** → check CloudWatch logs or contact backend agent

---

## Recently Resolved Blockers

**✅ Beta Team Access Not Working - Backend Side** (Resolved 2025-12-20 15:15)
- **Issue**: Beta teams (like "Les Orcades") could not access the game before official launch
- **Root Cause**: `gameAPI.getStatus()` used `axios.get()` instead of `api.get()`, bypassing auth interceptor
- **Resolution**: Changed line 194 in `frontend/src/services/api.ts` to use `api.get('/game/status')`
- **Implementation**:
  - Modified `gameAPI.getStatus()` to use configured `api` instance with auth interceptor
  - Auth token now automatically sent with every `/game/status` request
  - Backend can now identify beta team members and grant early access
- **Files Modified**: `frontend/src/services/api.ts` (1 line change)
- **Deployment**: 2025-12-20 14:18 UTC
- **Build**: 249.73 kB gzipped (+1.16 kB)
- **CloudFront Invalidation**: I6XKVTWSIN1G900BNQIB4Y3UC
- **Impact**: Beta teams can now test the game before official start
- **Status**: ✅ **LIVE** at https://rallyehiver.fr

**✅ GET /teams endpoint limit too low** (Resolved 2025-12-12)
- **Feature**: Increased team list default limit from 50 to 200
- **Requested**: 2025-12-12
- **Resolution**: Updated `GET /teams` endpoint default limit parameter
- **Change Details**:
  - Modified `/backend/src/functions/teams/list.ts` line 9
  - Changed from: `const limit = parseInt(event.queryStringParameters?.limit || '50');`
  - Changed to: `const limit = parseInt(event.queryStringParameters?.limit || '200');`
- **Deployment**: 2025-12-12 (90s deployment to production)
- **Impact**: Users can now browse all 55 registered teams without hitting pagination
- **Frontend Action**: No changes required - endpoint returns more results automatically
- **Database Verification**: Confirmed 55 teams exist via DynamoDB scan
- **Documentation Updated**: API_CONTRACT.md includes new default and query parameters

**✅ Admin Users Management Endpoint** (Resolved 2025-12-07)
- **Feature**: Complete user list endpoint for admin interface
- **Requested**: 2025-12-07
- **Resolution**: Implemented `GET /admin/users/all` endpoint that returns ALL users with extended info
- **Required Response Fields**:
  ```json
  {
    "users": [
      {
        "userId": "uuid",
        "email": "string",
        "displayName": "string",
        "createdAt": "ISO 8601 timestamp",
        "lastLoginAt": "ISO 8601 timestamp | null",  // NEW - track last login
        "teamId": "uuid | null",
        "teamName": "string | null",
        "isTeamLeader": boolean,
        "teamStatus": "no_team" | "pending" | "member",  // NEW - consolidated status
        "pendingTeamName": "string | null",
        "passwordAttemptsCount": number,  // NEW - total enigma password attempts
        "isAdmin": boolean
      }
    ],
    "count": number
  }
  ```
- **Use Case**: Admin needs to:
  - View all registered users in one page
  - Filter by team status (no team, pending, in team)
  - Filter by role (team leader vs member)
  - Search by name or email
  - See password attempt statistics per user
  - Track last login activity
- **Frontend Actions Blocked**:
  - Cannot implement admin users management page
  - Cannot provide user activity analytics
  - Cannot track user engagement metrics

### Medium Priority

*No current blockers*

### Low Priority
*No current blockers*

---

## Feature Requests

### Requested Features (Backend Implementation Needed)

| Feature | Priority | Status | Details |
|---------|----------|--------|---------|
| PDF Viewer Component | Medium | 📋 Requested | Need inline PDF viewing or integration guidance |
| Admin Dashboard | Low | 📋 Requested | UI for creating/managing enigmas and parcours |
| Leaderboard UI | Medium | 📋 Requested | Display team rankings (backend endpoint exists) |

---

## Questions for Backend

### Open Questions

**Q1: PDF Viewing Strategy**
- **Asked**: 2025-11-16
- **Question**: Should we use PDF.js for inline viewing, or rely on browser default PDF viewer via links?
- **Impact**: Affects UX design for enigma and parcours panels
- **Status**: ✅ **RESOLVED** (2025-11-16)
- **Decision**: Use direct S3 URLs with browser default viewer
- **Rationale**:
  - S3 bucket configured with CORS for https://proto.rallyehiver.fr
  - PDFs served with correct `content-type: application/pdf` header
  - Browser native viewer provides best compatibility (Chrome, Firefox, Safari, Edge 90+)
  - No additional JavaScript library needed (reduces bundle size)
  - Simple implementation: `<a href={enigma.pdfUrl} target="_blank">View PDF</a>`
- **S3 Bucket**: `rallyehiver-enigmas` (eu-west-1)
- **URL Pattern**: `https://rallyehiver-enigmas.s3.eu-west-1.amazonaws.com/2025/enigma-{number}.pdf`

**Q2: Admin Role Implementation**
- **Asked**: 2025-11-16
- **Question**: How is admin role checked? Is there an `isAdmin` field on User model?
- **Impact**: Need to know how to restrict admin endpoints in frontend
- **Status**: Awaiting clarification

**Q3: Real-time Updates**
- **Asked**: 2025-11-16
- **Question**: Should we implement WebSocket for real-time leaderboard updates, or is polling sufficient?
- **Impact**: Architecture decision for live features
- **Status**: Awaiting decision

### Resolved Questions

**Q1: PDF Viewing Strategy** (Resolved 2025-11-16)
- **Answer**: Use direct S3 URLs with browser default PDF viewer
- **Implementation**: PDFs publicly accessible at `https://rallyehiver-enigmas.s3.eu-west-1.amazonaws.com/2025/enigma-{XX}.pdf`
- **Frontend Action**: Use `<a href={enigma.pdfUrl} target="_blank">` or embed with `<iframe src={enigma.pdfUrl}>`

---

## API Issues & Feedback

### Working Well ✅
- Authentication flow is smooth
- Team management endpoints are intuitive
- Payment flow works perfectly with Stripe
- Game progress endpoints return exactly what's needed
- Error messages are clear and actionable
- Admin CRUD operations work seamlessly
- Drag-and-drop reordering with backend sync (as of 2025-11-29)

### Suggestions for Improvement
*None at this time*

---

## Data Format Requests

### Timestamps
- **Current**: ISO 8601 format
- **Request**: ✅ Perfect, no changes needed

### Pagination
- **Current**: Not implemented for most endpoints
- **Future Request**: Consider pagination for teams list if number of teams grows large
- **Priority**: Low (not needed for MVP)

### File Uploads
- **Current**: Not implemented
- **Future Request**: Direct S3 upload for PDFs from admin panel
- **Priority**: Low (can manually upload for MVP)

---

## UI/UX Dependencies

### Current Dependencies on Backend
1. **Content Access**: Relies on `GET /content/check-access` before showing game UI
2. **Real-time Stats**: Polls `GET /progress` and `GET /teams/{teamId}` for updates
3. **Password Feedback**: Depends on detailed response from `POST /progress/attempt`
4. **Parcours Unlocking**: Relies on `newlyUnlockedParcours` in attempt response

### Future Enhancements Needed
1. **Notifications**: When new parcours unlocks, show toast/modal (already handled)
2. **Hints System**: Potential future feature (not in current spec)
3. **Team Chat**: Out of scope for MVP

---

## Browser Compatibility

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Known Issues
*None reported*

---

## Performance Considerations

### Current Performance
- Initial load: ~107 KB gzipped (excellent)
- API response times: <500ms average
- No performance issues reported

### Optimization Requests
*None needed at this time*

---

## Mobile Experience

### Current Status
- ✅ Fully responsive design
- ✅ Touch-friendly UI elements
- ✅ Mobile-first CSS approach

### Issues
*None reported*

---

## Testing Feedback

### Manual Testing Results
- ✅ All core flows tested and working
- ✅ Password attempt flow validated
- ✅ Parcours unlocking tested successfully
- ✅ Team management flows confirmed

### Automated Testing
- Functional tests exist in `/tests` directory
- Frontend unit tests: To be added (low priority)

---

## Documentation Needs

### Requests
1. **Deployment Guide**: ✅ Already documented in README.md
2. **API Examples**: ✅ Already documented in API_CONTRACT.md
3. **Troubleshooting**: ✅ Covered in README.md

### Missing Documentation
*None identified*

---

## Notes for Backend Agent

### What Frontend Needs to Know
1. **Breaking Changes**: Always announce in this document before deploying
2. **New Endpoints**: Document in API_CONTRACT.md before implementation
3. **Schema Changes**: Update DATA_MODELS.md when database schemas change
4. **Deployment Status**: Update COORDINATION-LOG.md after deploying new features

### Communication Protocol
- Frontend will update this file with new requirements
- Backend should check this file before starting work sessions
- Use COORDINATION-LOG.md for status updates and notifications

---

## Historical Requests (Completed)

| Request | Date Requested | Date Completed | Notes |
|---------|----------------|----------------|-------|
| PUT /admin/enigmas/{enigmaId} endpoint | 2025-11-29 | 2025-11-29 | Created admin endpoint with CORS + enigmaNumber support |
| CORS fix for PUT /enigmas/{enigmaId} | 2025-11-29 | 2025-11-29 | Added explicit CORS config + enigmaNumber field support |
| GET /enigmas | 2025-11-16 01:15 | 2025-11-16 09:00 | Implemented and deployed |
| GET /parcours | 2025-11-16 01:15 | 2025-11-16 09:00 | Implemented and deployed |
| POST /progress/attempt | 2025-11-16 01:15 | 2025-11-16 09:00 | Implemented and deployed |
| GET /progress | 2025-11-16 01:15 | 2025-11-16 09:00 | Implemented and deployed |
| GET /progress/parcours | 2025-11-16 01:15 | 2025-11-16 09:00 | Implemented and deployed |
| GET /admin/leaderboard | 2025-11-16 01:15 | 2025-11-16 09:00 | Implemented and deployed |

---

## Summary

**Current State**: ✅ All critical features implemented and deployed to production

**Next Steps**:
1. Consider implementing leaderboard UI (low priority)
2. Add admin dashboard for content management (low priority)
3. Decide on PDF viewing strategy for better UX

**Backend Dependencies**: None (all required APIs are implemented)

**Deployment**: Frontend is live at https://proto.rallyehiver.fr with full backend integration
