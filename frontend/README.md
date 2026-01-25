# Rallye d'Hiver - Frontend

React TypeScript frontend for the Rallye d'Hiver enigma game platform.

## Features

- ✅ User authentication (email/password)
- ✅ Team creation and management
- ✅ Join team requests with approval workflow
- ✅ Stripe payment integration
- ✅ Access-gated content
- ✅ Mobile-first responsive design

## Tech Stack

- **React 18** with TypeScript
- **React Router v6** for routing
- **TanStack Query** for server state management
- **Axios** for API calls
- **CSS** for styling (no framework, mobile-first)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Configure Environment

Create `.env.local`:

```
REACT_APP_API_URL=http://localhost:3001
REACT_APP_COGNITO_USER_POOL_ID=eu-west-1_xxxxx
REACT_APP_COGNITO_CLIENT_ID=xxxxx
REACT_APP_COGNITO_REGION=eu-west-1
```

### Run Development Server

```bash
npm start
```

Opens at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

Creates optimized build in `build/` directory.

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/login` | Public | Login page |
| `/signup` | Public | Signup page |
| `/dashboard` | Protected | User dashboard |
| `/team/create` | Protected | Create new team |
| `/team/browse` | Protected | Browse all teams |
| `/team/:teamId` | Protected | Team detail page |
| `/content` | Protected | Enigma content (requires paid team) |

## Deployment

### Build

```bash
npm run build
```

### Deploy to S3

```bash
aws s3 sync build/ s3://proto.rallyehiver.fr --delete
```

See main README for full deployment instructions.
