# Admin Frontend Application

A comprehensive admin panel for managing the Rallye d'Hiver game, built with the same design system as the main game application.

## Features

### 1. Dashboard
- Overview statistics (teams, players, enigmas, parcours, payments, attempts)
- Success rate tracking
- Quick action buttons
- Auto-refresh every 30 seconds

### 2. Enigmas Management
- List all enigmas with statistics
- Create new enigmas
- Edit existing enigmas
- Delete enigmas
- View attempt statistics per enigma
- Toggle active/inactive status
- Track difficulty levels (easy, medium, hard)

### 3. Parcours Management
- List all parcours with statistics
- Create new parcours
- Edit existing parcours
- Delete parcours
- Configure required enigmas (specific or count-based)
- View unlock statistics
- Toggle active/inactive status

### 4. Teams Monitoring
- View all teams with progress tracking
- Team statistics (members, solved enigmas, unlocked parcours, points)
- Payment status tracking
- Expandable detailed progress view
- Last activity tracking
- Individual team member details

### 5. Attempts Tracking
- Real-time attempt monitoring
- Filter by success/failure status
- View submitted passwords
- Track attempt timestamps
- User attribution for each attempt
- Pagination support
- Success rate analytics

## Structure

```
src/admin/
├── AdminApp.tsx              # Main admin application component
├── AdminApp.css             # Admin app styles
├── types/
│   └── index.ts             # Admin-specific TypeScript types
├── services/
│   └── adminAPI.ts          # Admin API service layer
├── contexts/
│   └── AdminAuthContext.tsx # Admin authentication context
├── components/
│   ├── AdminLayout.tsx      # Admin layout with sidebar navigation
│   └── AdminLayout.css      # Admin layout styles
└── pages/
    ├── AdminLogin.tsx       # Admin login page
    ├── AdminLogin.css
    ├── AdminDashboard.tsx   # Dashboard with overview stats
    ├── AdminDashboard.css
    ├── AdminEnigmas.tsx     # Enigmas CRUD page
    ├── AdminEnigmas.css
    ├── AdminParcours.tsx    # Parcours CRUD page
    ├── AdminParcours.css
    ├── AdminTeams.tsx       # Teams monitoring page
    ├── AdminTeams.css
    ├── AdminAttempts.tsx    # Attempts tracking page
    └── AdminAttempts.css
```

## Design System

The admin panel uses the same comic book-style design system as the main game:

### Colors
- Primary Blue: `#0052CC`
- Primary Red: `#DC143C`
- Primary Yellow: `#FFD700`
- Primary Green: `#28a745`
- Secondary Orange: `#FF8C00`
- Secondary Purple: `#6B46C1`

### Typography
- Display: `Bangers` (for headings)
- Body: `Poppins` (for content)

### Components
- Comic-style borders (2-4px solid black)
- Shadow effects for elevation
- Hover animations (translateY)
- Status badges with color coding
- Responsive tables and grids

## Routes

- `/admin` - Redirects to dashboard or login
- `/admin/dashboard` - Overview statistics
- `/admin/enigmas` - Enigmas management
- `/admin/parcours` - Parcours management
- `/admin/teams` - Teams monitoring
- `/admin/attempts` - Attempts tracking

## Authentication

The admin panel uses a separate authentication flow:
- Separate admin token stored in `localStorage` as `adminAccessToken`
- Admin-specific context (`AdminAuthContext`)
- Automatic verification on app load
- Protected routes (redirects to login if not authenticated)

## API Integration

All admin endpoints are expected under `/admin` path:

### Auth
- `POST /admin/auth/login` - Admin login
- `GET /admin/auth/verify` - Verify admin status

### Stats
- `GET /admin/stats/overview` - Dashboard statistics

### Enigmas
- `GET /admin/enigmas` - List all enigmas with stats
- `GET /admin/enigmas/:id` - Get enigma details
- `POST /admin/enigmas` - Create enigma
- `PUT /admin/enigmas/:id` - Update enigma
- `DELETE /admin/enigmas/:id` - Delete enigma

### Parcours
- `GET /admin/parcours` - List all parcours with stats
- `GET /admin/parcours/:id` - Get parcours details
- `POST /admin/parcours` - Create parcours
- `PUT /admin/parcours/:id` - Update parcours
- `DELETE /admin/parcours/:id` - Delete parcours

### Teams
- `GET /admin/teams` - List all teams with progress
- `GET /admin/teams/:id` - Get team details
- `GET /admin/teams/:id/progress` - Get detailed progress

### Attempts
- `GET /admin/attempts` - List attempts with filters
- `GET /admin/attempts/team/:teamId` - Get team attempts
- `GET /admin/attempts/enigma/:enigmaId` - Get enigma attempts

## Next Steps (Backend Required)

To make the admin panel functional, the backend needs to implement:

1. Admin authentication endpoints
2. Admin role verification
3. All CRUD endpoints for enigmas and parcours
4. Team monitoring endpoints with aggregated stats
5. Attempts tracking endpoints with filtering
6. Dashboard statistics aggregation

## Usage

1. Navigate to `/admin` in your browser
2. Login with admin credentials
3. Access any of the management pages via the sidebar navigation
4. Use the dashboard for quick overview
5. Manage enigmas and parcours with full CRUD operations
6. Monitor teams and their progress
7. Track all password attempts in real-time

## Responsive Design

The admin panel is fully responsive:
- Desktop: Full sidebar with expanded navigation
- Tablet: Adjusted layouts with flexible grids
- Mobile: Stacked layouts with scrollable tables
