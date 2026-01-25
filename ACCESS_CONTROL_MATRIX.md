# Access Control Matrix

**Last Updated**: 2025-11-22
**Version**: Production (prod)

This document describes the access control for all API endpoints in the Rallye d'Hiver application.

## User Types

- **Unauthenticated**: No JWT token provided
- **Authenticated**: Valid JWT token, logged in user
- **Team Member**: Authenticated user who belongs to a team (not leader)
- **Team Leader**: Authenticated user who created/leads a team
- **Myself**: Accessing own user data
- **Admin**: Special administrative privileges (⚠️ **NOT CURRENTLY ENFORCED**)

## Legend

- ✅ **Allowed**: Full access
- ⚠️ **Partial**: Conditional access (see notes)
- ❌ **Denied**: No access / 401 Unauthorized
- 🔓 **Public**: No authentication required

---

## Authentication Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/auth/signup` | POST | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | Public - creates new account |
| `/auth/login` | POST | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | Public - returns JWT tokens |
| `/auth/me` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Returns own user info |

---

## User Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/users/pending-requests` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Shows teams where user has pending join requests |

---

## Team Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/teams` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Lists ALL teams with basic info (name, member count, payment status) |
| `/teams` | POST | ❌ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | Create team - requires user NOT already in a team |
| `/teams/{teamId}` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | View ANY team's details (members, leader). Pending requests only visible to team members |
| `/teams/{teamId}/join` | POST | ❌ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | Request to join - requires user NOT already in a team |
| `/teams/{teamId}/approve/{userId}` | POST | ❌ | ⚠️ | ❌ | ✅ | ⚠️ | ⚠️ | Only team leader can approve. Must be leader of THIS team |
| `/teams/{teamId}/reject/{userId}` | POST | ❌ | ⚠️ | ❌ | ✅ | ⚠️ | ⚠️ | Only team leader can reject. Must be leader of THIS team |
| `/teams/{teamId}/members/{userId}` | DELETE | ❌ | ⚠️ | ❌ | ✅ | ⚠️ | ⚠️ | Only team leader can remove members. Cannot remove self |

---

## Payment Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/payments/create-checkout` | POST | ❌ | ⚠️ | ❌ | ✅ | ⚠️ | ⚠️ | Only team leader can initiate payment |
| `/payments/webhook` | POST | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | Called by Stripe (verified via webhook signature) |

---

## Content Access Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/content/check-access` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Returns true if user's team has paid |
| `/content/enigma` | GET | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Requires user in paid team |

---

## Enigma Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/enigmas` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Lists all active enigmas (password NOT exposed) |
| `/enigmas` | POST | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ **SECURITY ISSUE**: Should be admin-only |
| `/enigmas/{enigmaId}` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Get enigma details (password NOT exposed) |
| `/enigmas/{enigmaId}` | PUT | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ **SECURITY ISSUE**: Should be admin-only |
| `/enigmas/{enigmaId}` | DELETE | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ **SECURITY ISSUE**: Should be admin-only |

---

## Parcours Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/parcours` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Lists all active parcours |
| `/parcours` | POST | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ **SECURITY ISSUE**: Should be admin-only |
| `/parcours/{parcoursId}` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Get parcours details |
| `/parcours/{parcoursId}/access` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Always returns true (all parcours unlocked) |
| `/parcours/{parcoursId}/complete` | POST | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Mark parcours complete - requires team membership |

---

## Progress Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/progress/attempt` | POST | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Submit password - requires user in PAID team |
| `/progress` | GET | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Get own team's enigma progress - requires team membership |
| `/progress/parcours` | GET | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Get own team's parcours - requires team membership |

---

## Admin Endpoints

| Endpoint | Method | Unauthenticated | Authenticated | Team Member | Team Leader | Myself | Admin | Notes |
|----------|--------|----------------|---------------|-------------|-------------|---------|-------|-------|
| `/admin/leaderboard` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ **SECURITY ISSUE**: Should be admin-only. Shows all teams' rankings |
| `/admin/attempts/team/{teamId}` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ **SECURITY ISSUE**: Should be admin-only. Shows password attempts for any team |
| `/admin/attempts/enigma/{enigmaId}` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ **SECURITY ISSUE**: Should be admin-only. Shows all password attempts for an enigma |

---

## Information Disclosure Summary

### What Teams Can See About Other Teams

| Information | Visibility | Endpoint |
|------------|-----------|----------|
| Team name | ✅ Public | `GET /teams`, `GET /teams/{teamId}` |
| Member count | ✅ Public | `GET /teams` |
| Payment status | ✅ Public | `GET /teams`, `GET /teams/{teamId}` |
| Member names & IDs | ✅ Public | `GET /teams/{teamId}` |
| Leader ID | ✅ Public | `GET /teams/{teamId}` |
| Pending join requests | ❌ Private (team members only) | `GET /teams/{teamId}` |
| Solved enigma count | ✅ Public | `GET /admin/leaderboard` |
| Last activity time | ✅ Public | `GET /admin/leaderboard` |
| Ranking position | ✅ Public | `GET /admin/leaderboard` |
| Specific solved enigmas | ❌ Private | `GET /progress` (own team only) |
| Password attempts | ⚠️ **EXPOSED** | `GET /admin/attempts/team/{teamId}` |
| Parcours completion status | ❌ Private | `GET /progress/parcours` (own team only) |

---

## Critical Security Issues

### 🚨 High Priority

1. **Admin endpoints have NO role checks**
   - Any authenticated user can:
     - Create/modify/delete enigmas and parcours
     - View all password attempts for any team
     - View complete leaderboard
   - **Impact**: Competition integrity compromised
   - **Fix**: Add admin role check in User model and validate in endpoints

2. **Password attempts are viewable by anyone**
   - Endpoint: `GET /admin/attempts/team/{teamId}`
   - **Impact**: Teams can see other teams' failed/successful attempts
   - **Fix**: Restrict to admin only

3. **Team member lists are fully public**
   - Any authenticated user can see who is on any team
   - **Impact**: Privacy concern, potential for social engineering
   - **Fix**: Consider hiding member details from non-team members

### ⚠️ Medium Priority

4. **No rate limiting on sensitive endpoints**
   - Password attempts can be brute-forced
   - **Fix**: Add rate limiting on `POST /progress/attempt`

5. **Team browsing shows all teams**
   - All teams visible to all users
   - **Impact**: Minor privacy concern
   - **Fix**: Optional - could hide teams that haven't paid

---

## Recommendations

### Immediate Actions

1. **Add admin role to User model**:
   ```typescript
   export interface User {
     userId: string;
     email: string;
     displayName: string;
     teamId: string | null;
     role: 'leader' | 'member' | null;
     isAdmin?: boolean;  // ADD THIS
     // ...
   }
   ```

2. **Create admin middleware**:
   ```typescript
   function requireAdmin(userId: string): boolean {
     const user = await getUserById(userId);
     if (!user?.isAdmin) {
       throw new Error('Admin access required');
     }
     return true;
   }
   ```

3. **Protect admin endpoints**:
   - Add admin check to all `/admin/*` endpoints
   - Add admin check to enigma/parcours creation/modification
   - Restrict password attempt viewing to admin only

### Long-term Improvements

1. Implement proper RBAC (Role-Based Access Control)
2. Add audit logging for admin actions
3. Add rate limiting on sensitive endpoints
4. Consider making leaderboard visible only during competition
5. Add team privacy settings (public/private teams)

---

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| JWT Authentication | ✅ Implemented | Via AWS Cognito |
| Team-based Authorization | ⚠️ Partial | Team member checks exist, but inconsistent |
| Admin Role | ❌ Not Implemented | TODOs in code, not enforced |
| Rate Limiting | ❌ Not Implemented | Should add for password attempts |
| Audit Logging | ❌ Not Implemented | Only console.log currently |
| CORS | ✅ Implemented | Configured for frontend domain |

---

**Last Review**: 2025-11-22
**Reviewed By**: Backend Agent (Claude Code)
