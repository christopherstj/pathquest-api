# PathQuest API Guide

## Route Organization

All routes prefixed with `/api`:
- `/api/auth` - Signup, mobile auth, Strava creds
- `/api/users` - Profiles, settings, journal
- `/api/activities` - Activity data (owner-only per Strava ToS)
- `/api/peaks` - Peak catalog, summits, favorites
- `/api/challenges` - Challenge definitions, progress
- `/api/photos` - Photo uploads (GCS signed URLs)
- `/api/search` - Unified relevancy search
- `/api/billing` - Stripe subscriptions

## Authentication

**Two token types**:
1. NextAuth JWT (web) - decoded via `NEXTAUTH_SECRET`
2. PathQuest Mobile Token - signed via `PATHQUEST_MOBILE_SECRET`

**Plugin decorators**:
- `fastify.authenticate` - Requires valid token
- `fastify.optionalAuth` - Works with or without auth

**Owner checks**: Use `request.user.id` from verified token

## Privacy Model

- Private users: only owner can access
- Public users: anyone can access (but only public summits)
- Return 404 (not 403) for unauthorized access

**Strava API Compliance**: Activity data is owner-only. Public summit reports exclude `activity_id`.

## Summit Confirmation Flow

```typescript
confirmation_status: 'auto_confirmed' | 'unconfirmed' | 'user_confirmed' | 'denied'
```
- Denied summits kept for audit but excluded from counts
- Filter: `COALESCE(confirmation_status, 'auto_confirmed') != 'denied'`

## Adding a New Endpoint

```typescript
// 1. Create route file: src/routes/myFeature/myRoute.ts
import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/my-endpoint', {
    preHandler: [fastify.authenticate], // or optionalAuth
  }, async (request, reply) => {
    const userId = request.user?.id;
    // ... implementation
  });
}

// 2. Create helper: src/helpers/myFeature/myHelper.ts
// 3. Register in src/routes/index.ts
```

## Photo Storage (GCS)

- Direct upload via signed PUT URLs
- Server generates thumbnails via Sharp
- Bucket: `pathquest-photos` (private, signed URLs only)
