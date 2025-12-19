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
- `GET /:userId/profile` — Aggregated profile data including stats, accepted challenges, and peaks for map (optional auth, privacy-aware)
- `GET /:userId/peaks` — Search user's summited peaks with summit counts (optional auth, privacy-aware, supports `search`, `page`, `pageSize` query params)
- `GET /:userId/summits` — Search user's individual summit entries (optional auth, privacy-aware, supports `search`, `page`, `pageSize` query params)
- `GET /:userId/activities-processing` — Owner only
- `GET /:userId/is-subscribed` — Owner only
- `PUT /:userId` — Owner only. Supports updating: `name`, `email`, `pic`, `city`, `state`, `country`, `location_coords` (as [lng, lat]), `update_description`, `is_public`
- `DELETE /:userId` — Owner only

#### User Profile Privacy Model
User profiles follow the same privacy model as activities:
- If user is private (`users.is_public = false`) → only owner can access profile endpoints
- If user is public → anyone can access (but only public summits are included)
- When owner accesses their own profile, private summits are included in stats
- When access is denied, return 404 (not 403) to not reveal existence of private users

### Activities (`/api/activities`)
- `GET /recent` — Most recent activities (optional `summitsOnly`) — auth required
- `GET /search/nearest` — Nearest activities by lat/lng — auth required
- `GET /search` — Search by bounds/search term — auth required
- `POST /by-peak` — Activities that summitted a peak `{ peakId }` — auth required
- `GET /:activityId` — Details + summits (optional auth, privacy-aware: public if both user & activity are public, otherwise owner only)
- `GET /:activityId/coords` — Activity coords (owner check) — auth required
- `DELETE /:activityId` — Delete (owner check) — auth required
- `POST /reprocess` — Re-run summit detection `{ activityId }` (owner check) — auth required

#### Activity Privacy Model
Activities follow a privacy model with two layers:
1. **User Privacy** (`users.is_public`): If false, all user's activities are private
2. **Activity Privacy** (`activities.is_public`): Per-activity visibility control

Access rules:
- If user is private → only owner can access their activities
- If activity is private → only owner can access that activity
- If both user AND activity are public → anyone can access
- When access is denied, return 404 (not 403) to not reveal existence of private activities

### Peaks (`/api/peaks`)
- Public data: `GET /` (list), `GET /search`, `GET /search/nearest`, `GET /:id`, `GET /:id/activity` (recent summit counts), `GET /top` (top peaks by summit count for static generation)
- User data (auth): `GET /summits/:userId` (owner), `GET /summits/unclimbed/nearest`, `GET /summits/unclimbed`, `GET /summits/recent`, `GET /summits/favorites`, `GET /summits/unconfirmed` (optional `limit` query param)
- Mutations (auth): `POST /summits/manual` (owner), `PUT /favorite`, `GET /favorite`, `POST /summits/:id/confirm`, `POST /summits/:id/deny`, `POST /summits/confirm-all`
- Ascent CRUD (auth + owner): `GET/PUT/DELETE /ascent/:ascentId` (ascent updates support `condition_tags` array)

#### Summit Confirmation Flow
Automatically detected summits may have low confidence scores and need user review:
- `confirmation_status` values: `auto_confirmed` (high confidence), `unconfirmed` (needs review), `user_confirmed` (user approved), `denied` (user rejected)
- Denied summits are kept for audit but excluded from all summit counts and lists (via `COALESCE(confirmation_status, 'auto_confirmed') != 'denied'` clause)
- Users can confirm/deny individual summits or bulk confirm all pending summits

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
- `getActivityDetails` - Used in routes. Returns activity + flat list of summits (with peak data nested in each summit)
- `getActivityOwnerId` - Used in routes
- `getActivityWithPrivacy` - Used in routes for privacy-aware activity access
- `getCoordsByActivity` - Used in routes
- `getMostRecentActivities` - Used in routes
- `getPeaksByActivity` - **UNUSED** - Previously used by `getActivityDetails`, now replaced by `getSummitsByActivity`
- `getReprocessingStatus` - Used internally by `reprocessActivity`
- `getSummitsByActivity` - Used internally by `getActivityDetails`. Returns all summits for an activity with full details (weather, notes, difficulty, experience rating) and peak data
- `getSummitsByPeakAndActivity` - **UNUSED** - Previously used by `getActivityDetails`, now replaced by `getSummitsByActivity`
- `reprocessActivity` - Used in routes
- `searchActivities` - Used in routes
- `searchNearestActivities` - Used in routes
- `setReprocessingStatus` - Used internally by `reprocessActivity`
- `deleteActivity` - Used in routes

### Challenges Helpers (`helpers/challenges/`)
- `addChallengeFavorite` - Used in routes
- `deleteChallengeFavorite` - Used in routes
- `getAllChallenges` - Used in routes. Filters challenges by bounds based on whether any peak in the challenge is within the viewport (not the challenge center point)
- `getChallengeById` - **UNUSED** - Not imported anywhere (neither routes nor other helpers)
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
- `getPeakSummits` - **UNUSED** - File is empty (only contains comment)
- `getPeakSummitsByUser` - Used in routes and profile page. Returns all peaks a user has summited with ascent data. Explicitly converts location_coords from geography to [lng, lat] array format for frontend compatibility.
- `getHistoricalWeather` - Used internally by `addManualPeakSummit` to fetch weather data for manual summit entries
- `getPublicSummitsByPeak` - Used in routes. Returns public summits with `user_id` and `user_name` joined from users table for display in frontend summit history. User ID enables profile linking in the Community tab. Filters out summits from private users (`users.is_public = false`) to respect user privacy settings.
- `getRecentSummits` - Used in routes
- `getSummitsByPeak` - Used in routes
- `getTopPeaksBySummitCount` - Used in routes (for static generation)
- `getUnclimbedPeaks` - Used in routes
- `removeFavoritePeak` - Used in routes
- `searchNearestPeaks` - Used in routes
- `searchPeaks` - Used in routes
- `searchUserPeaks` - Used in routes. Searches user's summited peaks by peak name with pagination, returns peaks with summit counts, first/last summit dates. Results ordered by summit_count descending (then by most recent summit date)
- `searchUserSummits` - Used in routes. Searches user's individual summit entries by peak name with pagination, returns summits with nested peak data
- `updateAscent` - Used in routes
- `getUnconfirmedSummits` - Used in routes. Fetches summits needing user review (confirmation_status = 'unconfirmed'). Optional limit param.
- `confirmSummit` - Used in routes. Sets confirmation_status to 'user_confirmed'. Verifies summit belongs to user.
- `denySummit` - Used in routes. Sets confirmation_status to 'denied'. Verifies summit belongs to user. Summit excluded from counts but kept for audit.
- `confirmAllSummits` - Used in routes. Bulk confirms all unconfirmed summits for a user.
- `getPeakActivity` - Used in routes. Returns summit counts for a peak (summitsThisWeek, summitsThisMonth, lastSummitDate). Public endpoint for peak activity indicators.

### User Helpers (`helpers/user/`)
- `addUserData` - Used in routes
- `addUserInterest` - Used in routes
- `createUser` - Used in routes
- `deleteUser` - Used in routes
- `getIsUserSubscribed` - Used in routes (note: filename typo `getIsUserSunscribed`)
- `getPublicUserProfile` - Used in routes
- `getUser` - Used in routes. Returns full user data including `is_public` field
- `getUserPrivacy` - Used in routes
- `getUserProfileStats` - Used in routes. Calculates aggregated profile statistics including: total peaks summited, total summits, highest peak, challenges completed, total elevation gained, states/countries climbed, year-over-year stats, and peak type breakdown (14ers, 13ers, etc.)
- `getUserAcceptedChallenges` - Used in routes. Returns challenges the user has "accepted" (favorited challenges that are not completed)
- `updateUser` - Used in routes. Supports updating: `name`, `email`, `pic`, `city`, `state`, `country`, `location_coords` (converts [lng, lat] to PostGIS geography), `update_description`, `is_public`

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
- `checkRateLimit` - **UNUSED** - Not imported in routes
- `convertPgNumbers` - **UNUSED** - Not imported anywhere
- `getCloudSqlConnection` - Used internally by all database helpers
- `getStravaAccessToken` - Used internally by helpers that need Strava API access
- `setUsageData` - **UNUSED** - Not imported in routes (may be used in workers)
- `updateStravaCreds` - Used in routes

### Authentication Plugin (`plugins/auth.ts`)
- `authenticate` - Fastify plugin decorator used extensively via `fastify.authenticate` in route handlers
- `optionalAuth` - Fastify plugin decorator used via `fastify.optionalAuth` for routes that work with or without auth
- Supports both NextAuth JWT tokens and header-based authentication (OIDC edge-to-origin)
- **Google ID Token Detection**: Automatically detects Google ID tokens (from Vercel OIDC → Google Workload Identity Federation) and skips NextAuth JWT decoding. Google tokens are validated by Google IAM at the infrastructure level, but user identity must come from `x-user-*` headers.

## Database Schema (Inferred)
Key tables:
- `users` - User accounts
- `activities` - Strava activities with coordinate data
- `peaks` - Mountain peak catalog
- `activities_peaks` - Junction table linking activities to summited peaks
- `user_peak_manual` - Manual peak summit entries
- `challenges` - Challenge definitions
- `peaks_challenges` - Junction table linking peaks to challenges
- `user_challenge_favorite` - User's favorited challenges
- `user_peak_favorite` - User's favorited peaks
- `event_queue` - Queue for processing Strava webhook events
- `strava_rate_limits` - Tracks Strava API rate limit usage
- `strava_tokens` - Stores Strava OAuth tokens

## External Integrations
- **Strava API**: Activity data, OAuth authentication
- **Google Maps Services**: Geocoding and mapping
- **Stripe**: Subscription billing
- **Google Cloud Pub/Sub**: Message queue for activity processing
## Notes
- Several helper functions are unused and could be cleaned up:
  - `getSummitsByActivity` - Not imported anywhere
  - `getNearbyPeaks` - Not imported in routes
  - `getPeakSummits` - File is empty
  - `getChallengeById` - Not used anywhere
  - `getSubscribedChallenges` - Entirely commented out
  - `addEventToQueue`, `checkRateLimit`, `convertPgNumbers`, `setUsageData` - Not used in API (may be used in backend workers)
- Some helper functions are used internally by other helpers but not directly in routes:
  - `getPeaksByActivity` - Used by `getActivityDetails`
  - `getActivityById` - Used by `getActivityDetails`
  - `getSummitsByPeakAndActivity` - Used by `getActivityDetails`
  - `getHistoricalWeather` - Used by `addManualPeakSummit`
  - `getRecentPeakSummits` - Used by `getMostRecentSummitByPeak`
  - Historical data helpers are used internally by `getUserHistoricalData`
- Authentication is handled via Fastify plugin (`plugins/auth.ts`), not a standalone helper function


