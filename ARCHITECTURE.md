# PathQuest API Architecture

## Overview
PathQuest API is a REST API built with Fastify that serves as the backend for the PathQuest web application. It connects to Strava to track user activities and catalog mountain summits based on GPS coordinate data.

## Tech Stack
- **Framework**: Fastify
- **Database**: PostgreSQL (via Cloud SQL)
- **Authentication**: NextAuth JWT tokens
- **External APIs**: Strava API, Google Maps Services, Stripe
- **Message Queue**: Google Cloud Pub/Sub

## Server Configuration
- Port: 8080
- Host: 0.0.0.0
- Logger: Enabled

## Routes (all prefixed with `/api`)

### Auth (`/api/auth`)
- `POST /signup` — Create user + Strava creds (public)
- `POST /strava-creds` — Update Strava creds (auth, owner)
- `POST /user-interest` — Collect waitlist emails (public)

### Authentication model
- The API accepts either a NextAuth JWT (decoded via `JWT_SECRET`) or header-derived identity.
- Header-based identity (for OIDC edge-to-origin): send `Authorization: Bearer <token>` plus `x-user-id: <userId>`. Optional headers: `x-user-email`, `x-user-name`, `x-user-public: true|false`.
- Owner checks rely on `request.user.id`. If neither JWT nor headers provide it, private routes return 401/403.

### Users (`/api/users`)
- `GET /:userId` — Public profile, private when requester matches (optional auth)
- `GET /:userId/activities-processing` — Owner only
- `GET /:userId/is-subscribed` — Owner only
- `PUT /:userId` — Owner only
- `DELETE /:userId` — Owner only

### Activities (`/api/activities`) — all auth
- `GET /recent` — Most recent activities (optional `summitsOnly`)
- `GET /search/nearest` — Nearest activities by lat/lng
- `GET /search` — Search by bounds/search term
- `POST /by-peak` — Activities that summitted a peak `{ peakId }`
- `GET /:activityId` — Details + summits (owner check)
- `GET /:activityId/coords` — Activity coords (owner check)
- `DELETE /:activityId` — Delete (owner check)
- `POST /reprocess` — Re-run summit detection `{ activityId }` (owner check)

### Peaks (`/api/peaks`)
- Public data: `GET /` (list), `GET /search`, `GET /search/nearest`, `GET /:id`
- User data (auth): `GET /summits/:userId` (owner), `GET /summits/unclimbed/nearest`, `GET /summits/unclimbed`, `GET /summits/recent`, `GET /summits/favorites`
- Mutations (auth): `POST /summits/manual` (owner), `PUT /favorite`, `GET /favorite`
- Ascent CRUD (auth + owner): `GET/PUT/DELETE /ascent/:ascentId`

### Challenges (`/api/challenges`)
- Public: `GET /` (list), `GET /:challengeId/details`
- Auth-filtered: `GET /search` (supports bounds, search, type, favorites)
- Auth-owner: `POST /incomplete`
- Favorites (auth + owner): `POST /favorite`, `PUT /favorite`, `DELETE /favorite/:challengeId`

### Billing (`/api/billing`) — auth + owner
- `POST /create-subscription`
- `POST /delete-subscription`

### Historical Data (`/api/historical-data`) — auth + owner
- `POST /` — Kick off historical Strava sync (async)

## Helper Functions

### Activities Helpers (`helpers/activities/`)
- `getActivitiesByPeak` - Used in routes
- `getActivitiesProcessing` - Used in routes
- `getActivityById` - Used internally by `getActivityDetails`
- `getActivityDetails` - Used in routes
- `getActivityOwnerId` - Used in routes
- `getCoordsByActivity` - Used in routes
- `getMostRecentActivities` - Used in routes
- `getPeaksByActivity` - **UNUSED** - Not imported anywhere
- `getReprocessingStatus` - Used internally by `reprocessActivity`
- `getSummitsByActivity` - **UNUSED** - Not imported anywhere
- `getSummitsByPeakAndActivity` - Used internally by `getActivityDetails`
- `reprocessActivity` - Used in routes
- `searchActivities` - Used in routes
- `searchNearestActivities` - Used in routes
- `setReprocessingStatus` - Used internally by `reprocessActivity`
- `deleteActivity` - Used in routes

### Challenges Helpers (`helpers/challenges/`)
- `addChallengeFavorite` - Used in routes
- `deleteChallengeFavorite` - Used in routes
- `getAllChallenges` - Used in routes
- `getChallengeById` - **UNUSED** - Not imported in routes (may be used internally)
- `getChallengeByUserAndId` - Used in routes
- `getChallenges` - Used in routes
- `getChallengesByPeak` - Used in routes
- `getPeaksByChallenge` - Used in routes
- `getRecentPeakSummits` - Used internally by `getMostRecentSummitByPeak`
- `getSubscribedChallenges` - **UNUSED** - Entirely commented out
- `getUncompletedChallenges` - Used in routes
- `updateChallengePrivacy` - Used in routes

### Peaks Helpers (`helpers/peaks/`)
- `addFavoritePeak` - Used in routes
- `addManualPeakSummit` - Used in routes
- `deleteAscent` - Used in routes
- `getAscentDetails` - Used in routes
- `getAscentOwnerId` - Used in routes
- `getFavoritePeaks` - Used in routes
- `getIsPeakFavorited` - Used in routes
- `getMostRecentSummitByPeak` - Used in routes
- `getNearbyPeaks` - **UNUSED** - Not imported in routes
- `getNearestUnclimbedPeaks` - Used in routes
- `getPeakById` - Used in routes
- `getPeaks` - Used in routes
- `getPeakSummits` - **UNUSED** - File appears empty or not imported
- `getPeakSummitsByUser` - Used in routes
- `getPublicSummitsByPeak` - Used in routes
- `getRecentSummits` - Used in routes
- `getSummitsByPeak` - Used in routes
- `getUnclimbedPeaks` - Used in routes
- `removeFavoritePeak` - Used in routes
- `searchNearestPeaks` - Used in routes
- `searchPeaks` - Used in routes
- `updateAscent` - Used in routes

### User Helpers (`helpers/user/`)
- `addUserData` - Used in routes
- `addUserInterest` - Used in routes
- `createUser` - Used in routes
- `deleteUser` - Used in routes
- `getIsUserSubscribed` - Used in routes (note: filename typo `getIsUserSunscribed`)
- `getPublicUserProfile` - Used in routes
- `getUser` - Used in routes
- `getUserPrivacy` - Used in routes
- `updateUser` - Used in routes

### Billing Helpers (`helpers/billing/`)
- `createSubscription` - Used in routes
- `deleteSubscription` - Used in routes

### Historical Data Helpers (`helpers/historical-data/`)
- `addActivityMessages` - Used internally by `getUserHistoricalData`
- `checkUserHistoricalData` - Used internally by `getUserHistoricalData`
- `getNextActivities` - Used internally by `getUserHistoricalData`
- `getUserHistoricalData` - Used in routes
- `setHistoricalDataFlag` - Used internally by `getUserHistoricalData`

### Core Helpers
- `addEventToQueue` - **UNUSED** - Not imported in API routes (used in backend workers)
- `authenticate` - **UNUSED** - Not imported/used as middleware
- `checkRateLimit` - **UNUSED** - Not imported in routes
- `convertPgNumbers` - **UNUSED** - Not imported anywhere
- `getCloudSqlConnection` - Used internally by all database helpers
- `getStravaAccessToken` - Used in root route and internally
- `setUsageData` - **UNUSED** - Not imported in routes (may be used in workers)
- `updateStravaCreds` - Used in routes

## Database Schema (Inferred)
Key tables:
- `users` - User accounts
- `activities` - Strava activities with coordinate data
- `peaks` - Mountain peak catalog
- `activities_peaks` - Junction table linking activities to summited peaks
- `user_peak_manual` - Manual peak summit entries
- `challenges` - Challenge definitions
- `peak_challenge` - Junction table linking peaks to challenges
- `user_challenge_favorite` - User's favorited challenges
- `user_peak_favorite` - User's favorited peaks
- `event_queue` - Queue for processing Strava webhook events
- `strava_rate_limits` - Tracks Strava API rate limit usage
- `strava_creds` - Stores Strava OAuth tokens

## External Integrations
- **Strava API**: Activity data, OAuth authentication
- **Google Maps Services**: Geocoding and mapping
- **Stripe**: Subscription billing
- **Google Cloud Pub/Sub**: Message queue for activity processing

## Notes
- The root route (`/`) appears to be unused and could be removed
- Several helper functions are unused and could be cleaned up
- The `authenticate` helper exists but is not used as middleware (authentication may be handled client-side)
- `convertPgNumbers` utility exists but is not used (PostgreSQL number conversion may be handled differently)
- Some helper functions are used internally by other helpers but not directly in routes

