# Admin Panel - Quick Start Guide

## Overview

The admin panel is a complete management interface for the Rallye d'Hiver game, featuring the same comic book design system as the player-facing application.

## Access

Navigate to `/admin` in your browser to access the admin panel.

## Features Summary

### Dashboard (`/admin/dashboard`)
- Total teams, players, enigmas, parcours
- Payment tracking
- Attempt statistics
- Success rate analytics
- Auto-refresh every 30 seconds

### Enigmas Management (`/admin/enigmas`)
- ✅ Create new enigmas
- ✅ Edit existing enigmas (title, description, PDF URL, points, difficulty)
- ✅ Delete enigmas
- ✅ Toggle active/inactive status
- ✅ View statistics (total attempts, successful attempts, teams solved)
- ✅ Filter by difficulty (easy, medium, hard)

### Parcours Management (`/admin/parcours`)
- ✅ Create new parcours
- ✅ Edit existing parcours
- ✅ Delete parcours
- ✅ Configure required enigmas (select specific enigmas)
- ✅ Set required enigma count threshold
- ✅ Toggle active/inactive status
- ✅ View unlock statistics

### Teams Monitoring (`/admin/teams`)
- ✅ View all registered teams
- ✅ Team statistics (members, solved enigmas, unlocked parcours, points)
- ✅ Payment status tracking
- ✅ Expandable detailed progress view
- ✅ Last activity tracking
- ✅ Team member details with leader identification

### Attempts Tracking (`/admin/attempts`)
- ✅ Real-time attempt monitoring
- ✅ Filter by success/failure
- ✅ View submitted passwords
- ✅ Timestamp tracking
- ✅ User attribution
- ✅ Pagination (50, 100, 250, 500 results)
- ✅ Success rate summary

## Technical Details

### Routes Structure
```
/admin              → Login or redirect to dashboard
/admin/dashboard    → Overview stats
/admin/enigmas      → CRUD for enigmas
/admin/parcours     → CRUD for parcours
/admin/teams        → Teams monitoring
/admin/attempts     → Attempts tracking
```

### Authentication
- Separate from main game authentication
- Admin token stored as `adminAccessToken` in localStorage
- Auto-verification on page load
- Protected routes with automatic redirect to login

### API Endpoints Required

The admin panel expects these backend endpoints:

#### Auth
```
POST /admin/auth/login
GET  /admin/auth/verify
```

#### Statistics
```
GET /admin/stats/overview
```

#### Enigmas
```
GET    /admin/enigmas
GET    /admin/enigmas/:id
POST   /admin/enigmas
PUT    /admin/enigmas/:id
DELETE /admin/enigmas/:id
```

#### Parcours
```
GET    /admin/parcours
GET    /admin/parcours/:id
POST   /admin/parcours
PUT    /admin/parcours/:id
DELETE /admin/parcours/:id
```

#### Teams
```
GET /admin/teams
GET /admin/teams/:id
GET /admin/teams/:id/progress
```

#### Attempts
```
GET /admin/attempts?success=true&limit=100&offset=0
GET /admin/attempts/team/:teamId
GET /admin/attempts/enigma/:enigmaId
```

## Design System

The admin panel uses the Rallye d'Hiver comic book design:
- **Fonts**: Bangers (display), Poppins (body)
- **Colors**: Blue (#0052CC), Red (#DC143C), Yellow (#FFD700), Orange (#FF8C00), Purple (#6B46C1)
- **Borders**: 2-4px solid black
- **Animations**: Hover effects, shadow elevations
- **Responsive**: Mobile, tablet, and desktop layouts

## File Structure

```
src/admin/
├── AdminApp.tsx                    # Main admin router
├── AdminApp.css                   # Admin app styles
├── types/index.ts                 # TypeScript interfaces
├── services/adminAPI.ts           # API service layer
├── contexts/AdminAuthContext.tsx  # Authentication state
├── components/
│   ├── AdminLayout.tsx           # Sidebar navigation layout
│   └── AdminLayout.css
└── pages/
    ├── AdminLogin.tsx            # Login page
    ├── AdminDashboard.tsx        # Dashboard overview
    ├── AdminEnigmas.tsx          # Enigmas CRUD
    ├── AdminParcours.tsx         # Parcours CRUD
    ├── AdminTeams.tsx            # Teams monitoring
    └── AdminAttempts.tsx         # Attempts tracking
```

## Development

The admin panel is integrated into the main app via routing:
- Main App.tsx routes `/admin/*` to AdminApp
- AdminApp provides admin-specific authentication context
- All admin routes are protected by authentication check

## Next Steps

To complete the admin panel functionality:

1. **Backend Implementation**: Implement all admin API endpoints
2. **Admin Role**: Add admin role to user model in backend
3. **Testing**: Test all CRUD operations
4. **Deployment**: Configure environment variables for production

## Notes

- All admin operations require authentication
- Admin and player authentication are separate
- The design system matches the main game for consistency
- Build successful with no errors ✅
