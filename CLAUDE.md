# Claude Code Agent Coordination Guide

## Overview

This document coordinates work between two Claude Code agents:
- **Backend Agent**: Launched from `backend/`
- **Frontend Agent**: Launched from `frontend/`

Both agents can read and write files in the root directory (parent of their launch directory) to maintain a shared contract and coordinate their work.

## Core Pattern

**This is a handoff workflow, not true parallelism.**

1. **Backend agent** completes a feature and documents it in shared files at root level
2. **Human reviews** the backend implementation and documentation
3. **Frontend agent** reads the shared documentation and implements against it
4. **Human reviews** the frontend implementation
5. Repeat

This prevents coordination conflicts and keeps both agents operating from a single source of truth.

## Quick Start for Agents

### AWS Credentials Setup (Backend Agent Only)

**Before any AWS operations**, ensure your AWS SSO token is valid:

```bash
aws sso login --profile claude-admin
```

**When to refresh**:
- If you see errors like `UnrecognizedClientException`, `ExpiredToken`, or credential-related failures
- Tokens typically expire after a few hours
- Run this command at the start of each work session

### Before Starting Any Work

**Backend Agent**:
1. Read `FRONTEND_REQUIREMENTS.md` first (check what frontend needs)
2. Read `COORDINATION-LOG.md` (check current status and requests queue)
3. Review `API_CONTRACT.md` and `DATA_MODELS.md` (understand current state)

**Frontend Agent**:
1. Read `API_CONTRACT.md` and `DATA_MODELS.md` first (understand what backend provides)
2. Read `COORDINATION-LOG.md` (check current status and backend updates)
3. Review `FRONTEND_REQUIREMENTS.md` (understand your own pending requests)

**Both Agents**:
- Always check `COORDINATION-LOG.md` before starting work
- Review `DECISIONS.md` for architectural context
- Update your status in `COORDINATION-LOG.md` when starting/finishing work

## Shared Files (Root Directory)

All coordination happens through files in the root directory. Agents access these via relative paths like `../API_CONTRACT.md`.

### `API_CONTRACT.md`

**Owner**: Backend Agent (primary writer)

Documents all API endpoints, request/response schemas, and data models that the frontend needs to implement against.

**Format**:
```markdown
# API Contract

Last updated by: backend agent
Last updated: [timestamp or commit hash]

## Endpoints

### POST /api/accounts
**Purpose**: Create a new account
**Request**: 
  - `name` (string, required)
  - `email` (string, required)
**Response** (201):
  - `id` (string)
  - `name` (string)
  - `createdAt` (ISO 8601 timestamp)
**Error** (400): `{ error: string }`

[... more endpoints ...]
```

### `DATA_MODELS.md`

**Owner**: Backend Agent (primary writer)

Database schemas, entity relationships, and type definitions that both frontend and backend need to align on.

**Format**:
```markdown
# Data Models

Last updated by: backend agent
Last updated: [timestamp]

## Account
- `id` (UUID, primary key)
- `name` (string, max 255)
- `email` (string, unique, max 255)
- `status` (enum: active, inactive, suspended)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

[... more models ...]
```

### `FRONTEND_REQUIREMENTS.md`

**Owner**: Frontend Agent (primary writer)

Requirements, blockers, or questions the frontend agent identifies that affect the backend.

**Format**:
```markdown
# Frontend Requirements & Blockers

Last updated by: frontend agent
Last updated: [timestamp]

## Implemented Features
- User authentication flow
- Account creation form

## Blockers
- **Awaiting**: Pagination API for account list (backend - in progress)
- **Issue**: API returns `createdAt` in UTC, but no timezone info provided for display

## Questions
- Should the API support batch operations for account updates?
```

### `DECISIONS.md`

**Owner**: Both agents (update as needed)

Architectural decisions, trade-offs, and shared assumptions that might affect both sides.

**Format**:
```markdown
# Decisions & Assumptions

## Authentication Strategy
- Using JWT tokens with 1-hour expiration
- Refresh tokens stored in httpOnly cookies
- Decision made: [date, reason]

## Error Handling
- All errors return JSON with `error` and `errorCode` fields
- HTTP status codes follow REST conventions
- Decision made: [date, reason]

[... more decisions ...]
```

### `COORDINATION-LOG.md`

**Owner**: Both agents (collaborative)

Daily sync, current status, requests queue, and recent notifications.

**Format**:
```markdown
# Frontend-Backend Coordination Log

## Current Status
- Backend Status: [current work, last deployment]
- Frontend Status: [current work, last deployment]

## Requests Queue
- Frontend → Backend: [list of requests]
- Backend → Frontend: [list of requests]

## Recent Notifications
- [Date]: [Agent] → [All]: [notification message]

## Breaking Changes Alert
- [Date]: [Endpoint]: [Change description]
```

**Purpose**: Lightweight daily coordination, status tracking, and request management

## Workflow Steps

### Backend Agent: Implementation Phase

1. Read `FRONTEND_REQUIREMENTS.md` to see what the frontend needs
2. Implement backend features (database, APIs, business logic)
3. **Update** `API_CONTRACT.md` with newly completed endpoints
4. **Update** `DATA_MODELS.md` if schemas changed
5. **Update** `DECISIONS.md` if you made architectural decisions that affect frontend
6. Stop and wait for human review

### Human Review & Approval

- Review backend code and documentation
- Verify `API_CONTRACT.md` is complete and accurate
- Approve or request changes
- Give frontend agent the go-ahead

### Frontend Agent: Implementation Phase

1. Read `API_CONTRACT.md` to understand what backend provides
2. Read `DATA_MODELS.md` to understand data structures
3. Implement frontend features (UI, state management, API calls)
4. **Identify blockers** → Update `FRONTEND_REQUIREMENTS.md` with questions/blockers
5. **Ask questions** about ambiguous API behavior in `FRONTEND_REQUIREMENTS.md`
6. Stop and wait for human review

### Human Review & Approval

- Review frontend code
- Read `FRONTEND_REQUIREMENTS.md` for any blockers or questions
- Respond to frontend questions (may require backend changes)
- Approve or request changes
- Decide: Does backend need to iterate based on frontend feedback?

### Iterate if Needed

If frontend blockers require backend changes:
1. Summarize the blocker in `DECISIONS.md` or relevant contract docs
2. Backend agent reads the blocker, implements the fix
3. Update contracts again
4. Frontend agent implements the fix

## File Access Rules

- **Backend agent** can read all files. Primarily writes: `API_CONTRACT.md`, `DATA_MODELS.md`, `DECISIONS.md`
- **Frontend agent** can read all files. Primarily writes: `FRONTEND_REQUIREMENTS.md`, `DECISIONS.md`
- **Both agents** should update `DECISIONS.md` if they make choices that affect the other

## Important Constraints

### No Simultaneous Writes
- Only one agent should be actively writing at a time
- This is why the handoff pattern works
- If both agents write to the same file simultaneously, corruption can occur

### File Staleness is Normal
- Documentation may lag behind actual implementation by a few minutes
- Always ask human reviewers to verify contracts match actual code
- Agents should re-read shared files before starting new work

### Relative Paths
- Backend agent: Use `../API_CONTRACT.md` to access root files
- Frontend agent: Use `../API_CONTRACT.md` to access root files
- Both should work from their respective directories

## Example Session

**Session 1: Backend Agent**
```
Human: "Implement user authentication endpoints. Update the contracts."

Backend Agent:
1. Reads FRONTEND_REQUIREMENTS.md → sees "need login endpoint"
2. Implements POST /api/auth/login, POST /api/auth/logout, etc.
3. Updates API_CONTRACT.md with full auth endpoints
4. Updates DATA_MODELS.md with User and Session models
5. Updates DECISIONS.md with JWT strategy details
6. Stops and awaits review
```

**Human Review**: "Looks good. API contract is clear."

**Session 2: Frontend Agent**
```
Human: "Implement login page and authentication flow. Use the API contract from backend."

Frontend Agent:
1. Reads API_CONTRACT.md → sees login endpoint details
2. Reads DATA_MODELS.md → sees User structure
3. Implements login form, API integration, session management
4. Notes issue in FRONTEND_REQUIREMENTS.md: "API returns userId but no userName for display"
5. Stops and awaits review
```

**Human Review**: "Frontend looks good. There's a blocker about userName."

**Session 3: Backend Agent (Iteration)**
```
Human: "Frontend blocked on userName not being returned. Fix it."

Backend Agent:
1. Reads FRONTEND_REQUIREMENTS.md → sees blocker
2. Updates login endpoint to return userName
3. Updates API_CONTRACT.md
4. Stops and awaits review
```

**Human Review**: "Approved."

**Session 4: Frontend Agent (Continuation)**
```
Human: "Backend fixed userName. Continue implementation."

Frontend Agent:
1. Re-reads API_CONTRACT.md → sees userName is now included
2. Implements display of userName in frontend
3. Completes feature
```

## Tips for Agents

- **Be specific in contracts** — Vague documentation creates rework
- **Timestamp updates** — Note when you last updated a shared file
- **Ask questions early** — Frontend blocker in `FRONTEND_REQUIREMENTS.md` now beats surprise later
- **Keep it simple** — These docs should be readable in <2 minutes

## When This Pattern Works Best

✅ Features with clear boundaries (auth, user management, specific API endpoints)
✅ Sequential feature implementation
✅ Teams that can handle handoff delays
✅ Projects where getting it right matters more than speed

## When This Pattern Struggles

❌ Tightly coupled features requiring constant back-and-forth
❌ Real-time collaborative development
❌ Prototyping where changes are frequent and unpredictable
❌ Situations requiring true parallel agent execution

---

**TL;DR**: Backend documents what it built. Frontend reads that and builds against it. Handoff workflow, not simultaneous. Keep contracts updated. Coordinate via root-level markdown files.
