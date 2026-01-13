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
The API supports two token types for authentication:

1. **NextAuth JWT** (web clients): Decoded via `NEXTAUTH_SECRET` (same secret NextAuth uses to sign tokens). Used by the web frontend which sends the session cookie token directly.
2. **PathQuest Mobile Token** (native clients): Signed/verified via `PATHQUEST_MOBILE_SECRET`. Issued by the `/api/auth/mobile/strava/exchange` endpoint after Strava PKCE OAuth.

Both token types contain user identity claims (`sub`, `email`, `name`, `is_public`).

**Header-based identity** (`x-user-*` headers) is only allowed in development mode for local testing.

Owner checks rely on `request.user.id` extracted from the verified token. If no valid token is provided, private routes return 401.

### Mobile Auth (`/api/auth/mobile`)
- `POST /strava/exchange` — Exchange Strava PKCE authorization code for PathQuest tokens. Accepts `{ code, codeVerifier }`, returns `{ accessToken, refreshToken, expiresAt, user }` (public)
- `POST /refresh` — Refresh an expired access token. Accepts `{ refreshToken }`, returns `{ accessToken, expiresAt }` (public)

### Users (`/api/users`)
- `GET /:userId` — Public profile, private when requester matches (optional auth)
- `GET /:userId/profile` — Aggregated profile data including stats, accepted challenges, and peaks for map (optional auth, privacy-aware)
- `GET /:userId/peaks` — Search user's summited peaks with summit counts (optional auth, privacy-aware, supports `search`, `page`, `pageSize` query params)
- `GET /:userId/summits` — Search user's individual summit entries (optional auth, privacy-aware, supports `search`, `page`, `pageSize` query params)
- `GET /:userId/journal` — Optimized paginated journal with inline activity data (optional auth, privacy-aware). Query params:
  - `cursor` - ISO timestamp for cursor-based pagination
  - `limit` - page size (default 20)
  - `search` - peak name search
  - `year` - filter by year
  - `hasReport` - filter by trip report status (`true`/`false`)
  - `peakId` - filter by specific peak
- `GET /:userId/activities-processing` — Owner only
- `GET /:userId/import-status` — Owner only. Returns detailed import progress: totalActivities, processedActivities, pendingActivities, summitsFound, percentComplete, estimatedHoursRemaining, status ('not_started'|'processing'|'complete'), message
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
- `GET /:activityId` — Details + summits (owner only) — auth required
- `GET /:activityId/coords` — Activity coords (owner check) — auth required
- `DELETE /:activityId` — Delete (owner check) — auth required
- `POST /reprocess` — Re-run summit detection `{ activityId }` (owner check) — auth required

#### Activity Privacy Model
**Strava API Compliance**: Per Strava guidelines, "Strava Data provided by a specific user can only be displayed or disclosed in your Developer Application to that user." All activity endpoints are now owner-only.

Access rules:
- Activity detail, coordinates, delete, and reprocess endpoints require authentication and owner verification
- Non-owners receive 404 (not 403) to not reveal existence of other users' activities
- Public summit reports (via `getPublicSummitsByPeak`) display PathQuest-derived data only (timestamp, notes, weather, ratings) without `activity_id`

### Peaks (`/api/peaks`)
- Public data: `GET /` (list), `GET /search`, `GET /search/nearest`, `GET /:id`, `GET /:id/activity` (recent summit counts), `GET /:id/public-summits` (cursor-based paginated public summits; query params: `cursor` ISO timestamp, `limit` default 20 max 100; returns `{ summits, nextCursor, totalCount }`), `GET /top` (top peaks by summit count for static generation), `GET /summits/public/recent` (most recent public summits across the whole community; no auth)
- Public photos: `GET /:id/photos` (native-uploaded summit photos with cursor-based pagination; signed URLs; query params: `cursor` ISO timestamp, `limit` default 20 max 100; returns `{ photos, nextCursor, totalCount }`)
- User actions (auth): `POST /:id/flag-for-review` (sets `needs_review = true` for a peak; allows users to flag incorrect coordinates for manual review)
- User data (auth): `GET /summits/:userId` (owner), `GET /summits/unclimbed/nearest`, `GET /summits/unclimbed`, `GET /summits/recent`, `GET /summits/favorites`, `GET /summits/unconfirmed` (optional `limit` query param)
- Mutations (auth): `POST /summits/manual` (owner), `PUT /favorite`, `GET /favorite`, `POST /summits/:id/confirm`, `POST /summits/:id/deny`, `POST /summits/confirm-all`
- Ascent CRUD (auth + owner): `GET/PUT/DELETE /ascent/:ascentId` (ascent updates support `condition_tags` array and `custom_condition_tags` JSONB array)

#### Summit Confirmation Flow
Automatically detected summits may have low confidence scores and need user review:
- `confirmation_status` values: `auto_confirmed` (high confidence), `unconfirmed` (needs review), `user_confirmed` (user approved), `denied` (user rejected)
- Denied summits are kept for audit but excluded from all summit counts and lists (via `COALESCE(confirmation_status, 'auto_confirmed') != 'denied'` clause)
- Users can confirm/deny individual summits or bulk confirm all pending summits

### Challenges (`/api/challenges`)
- Public: `GET /` (list), `GET /popular` (hybrid popularity ranking; does not return popularity counts), `GET /:challengeId/details` (includes progress with lastProgressDate/lastProgressCount), `GET /:challengeId/activity` (community activity stats)
- Auth-filtered: `GET /search` (supports bounds, search, type, favorites)
- Auth-required: `GET /:challengeId/next-peak` (closest and easiest unclimbed peak, supports `lat`/`lng` query params for distance calculation)
- Auth-owner: `POST /incomplete`
- Favorites (auth + owner): `POST /favorite`, `PUT /favorite`, `DELETE /favorite/:challengeId`

### Photos (`/api/photos`)
- `POST /upload-url` — Get a signed Google Cloud Storage upload URL for direct client upload (auth, owner-of-summit)
- `POST /:id/complete` — Confirm upload and generate thumbnail (auth, owner)
- `PUT /:id` — Update photo caption (auth, owner)
- `DELETE /:id` — Delete photo from storage + DB (auth, owner)
- `GET /by-summit` — Get photos for a specific summit (auth, owner only)
- `GET /by-summit/public` — Get public photos for a specific summit (no auth, only returns photos from public summits by public users)

### Utils (`/api/utils`)
- `GET /timezone` — Get IANA timezone string for coordinates (public, query params: `lat`, `lng`)

### Push Tokens (`/api/push-tokens`)
- `POST /` — Register or update a push token for the authenticated user (auth, body: `{ token, platform }`)
- `DELETE /:token` — Unregister a push token (auth)
- `GET /preferences` — Get user's notification preferences (auth)
- `PUT /preferences` — Update notification preferences (auth, body: `{ summit_logging_notifications? }`)

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
- `getSummitsByActivity` - Used internally by `getActivityDetails`. Returns all summits for an activity with full details (weather, notes, difficulty, experience rating) and peak data including `public_summits` count
- `getSummitsByPeakAndActivity` - **UNUSED** - Previously used by `getActivityDetails`, now replaced by `getSummitsByActivity`
- `reprocessActivity` - Used in routes
- `searchActivities` - Used in routes
- `searchNearestActivities` - Used in routes
- `setReprocessingStatus` - Used internally by `reprocessActivity`
- `deleteActivity` - Used in routes

### Challenges Helpers (`helpers/challenges/`)
- `addChallengeFavorite` - Used in routes
- `deleteChallengeFavorite` - Used in routes
- `getAllChallenges` - Used in routes. Filters challenges by bounds based on whether any peak in the challenge is within the viewport (not the challenge center point). Returns lastProgressDate and lastProgressCount for each challenge.
- `getChallengeById` - **UNUSED** - Not imported anywhere (neither routes nor other helpers)
- `getChallengeByUserAndId` - Used in routes
- `getChallenges` - Used in routes
- `getChallengesByPeak` - Used in routes
- `getChallengeProgress` - Used in routes. Returns total, completed, lastProgressDate, lastProgressCount for a challenge.
- `getChallengePeaksForUser` - Used in user routes. Returns peaks for a challenge with `is_summited` and `summit_date` for a specific user. Only includes public summit data per Strava API compliance. Used by `/users/:userId/challenges/:challengeId` endpoint.
- `getChallengeActivity` - Used in routes. Returns community activity stats: weeklyActiveUsers, weeklySummits, recentCompletions (last 30 days).
- `getPopularChallenges` - Used in routes. Returns challenges ordered by hybrid popularity (public favorites + recent activity). Popularity counts are used for ordering only and are not returned.
- `getNextPeakSuggestion` - Used in routes. Returns closest and easiest unclimbed peak for a challenge, calculated from user location using Haversine distance formula.
- `getPeaksByChallenge` - Used in routes. Returns peaks for a challenge with user's summit count and `public_summits` count
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
- `getPeakById` - Used in routes. Now includes `publicLand` field with the most important public land designation for peaks within protected areas (via `getPeakPublicLand`)
- `getPeakPublicLand` - Used internally by `getPeakById`. Returns the primary public land for a peak based on designation priority hierarchy (NP > NM > WILD > WSA > NRA > NCA > NWR > NF > NG > SP > SW > SRA > SF). Queries `peaks_public_lands` junction table joined with `public_lands`. Returns `{ name, type, typeName, manager }` or null.
- `getPeaks` - Used in routes
- `getPeakSummits` - **UNUSED** - File is empty (only contains comment)
- `getPeakSummitsByUser` - Used in routes and profile page. Returns all peaks a user has summited with ascent data and `public_summits` count. Explicitly converts location_coords from geography to [lng, lat] array format for frontend compatibility.
- `getHistoricalWeather` - Used internally by `addManualPeakSummit` to fetch weather data for manual summit entries
- `getPublicSummitsByPeak` - Used in routes. Returns public summits with `user_id` and `user_name` joined from users table for display in frontend summit history. User ID enables profile linking in the Community tab. Filters out summits from private users (`users.is_public = false`) to respect user privacy settings. **Note**: `activity_id` is intentionally excluded from the response to comply with Strava API guidelines (Strava data can only be shown to the activity owner).
- `getPublicSummitsByPeakCursor` - Cursor-based pagination for public summits. Returns paginated summits ordered by timestamp DESC (most recent first). Supports `cursor` (ISO timestamp) and `limit` (default 20, max 100) filters. Returns `{ summits, nextCursor, totalCount }`. Used by `/peaks/:id/public-summits` endpoint. Includes `summit_type` ('activity' | 'manual') and `photo_thumbnails` (array of signed URLs for first 4 photos).
- `getRecentPublicSummits` - Returns most recent public summits across the entire community, including `peak_name`, `summit_type` ('activity' | 'manual'), and `photo_thumbnails` (array of signed URLs for first 4 photos). No `activity_id` for Strava compliance.
- `getRecentSummits` - Used in routes
- `getSummitsByPeak` - Used in routes
- `getTopPeaksBySummitCount` - Used in routes (for static generation)
- `getUnclimbedPeaks` - Used in routes
- `removeFavoritePeak` - Used in routes
- `searchNearestPeaks` - Used in routes. Returns peaks sorted by distance with user's summit count and `public_summits` count
- `searchPeaks` - Used in routes. Fuzzy peak search with relevancy scoring using pg_trgm extension. Expands abbreviations (mt→mount), uses trigram similarity matching, and ranks results by: name similarity (50%), prefix match bonus (30%), and popularity/public summits (20%). Returns `public_summits` count
- `searchUserPeaks` - Used in routes. Searches user's summited peaks by peak name with pagination, returns peaks with summit counts (`summit_count`), `public_summits`, first/last summit dates. Results ordered by summit_count descending (then by most recent summit date)
- `searchUserSummits` - Used in routes. Searches user's individual summit entries by peak name with pagination, returns summits with nested peak data
- `updateAscent` - Used in routes
- `getUnconfirmedSummits` - Used in routes. Fetches summits needing user review (confirmation_status = 'unconfirmed'). Optional limit param.
- `confirmSummit` - Used in routes. Sets confirmation_status to 'user_confirmed'. Verifies summit belongs to user.
- `denySummit` - Used in routes. Sets confirmation_status to 'denied'. Verifies summit belongs to user. Summit excluded from counts but kept for audit.
- `confirmAllSummits` - Used in routes. Bulk confirms all unconfirmed summits for a user.
- `getPeakActivity` - Used in routes. Returns summit counts for a peak (summitsThisWeek, summitsThisMonth, lastSummitDate). Public endpoint for peak activity indicators.
- `flagPeakForReview` - Used in routes. Sets `needs_review = true` for a peak, flagging it for coordinate verification.

### Photos Helpers (`helpers/photos/`)
- `getSignedUploadUrl` - Generates signed PUT URL for direct GCS upload
- `createPendingPhoto` - Inserts pending `summit_photos` record (verifies summit ownership)
- `completePhotoUpload` - Downloads uploaded file, compresses original, generates thumbnail (Sharp), updates DB
- `deletePhoto` - Deletes objects in GCS and removes DB record
- `getPhotosByPeak` - Returns public photos for a peak with cursor-based pagination and signed URLs. Supports `cursor` (ISO timestamp) and `limit` (default 20, max 100) filters. Returns `{ photos, nextCursor, totalCount }`. Total count is only calculated on the first page for efficiency.
- `getPhotosBySummit` - Returns owner's photos for a specific summit (for editing flows)
- `getPublicPhotosBySummit` - Returns public photos for a specific summit (for community section). Only returns photos if summit is public AND user is public. Used by `PublicSummitCard` to show photos on public summit cards.

### Search Helpers (`helpers/search/`)
- `expandSearchTerm` - Expands search abbreviations (mt→mount, mtn→mountain, pk→peak, pt→point, etc.). Returns array of search variations. Also exports `getPrimaryExpansion` for the main expanded form and `buildSearchPatterns` for SQL ILIKE patterns.

### Notifications Helpers (`helpers/notifications/`)
- `registerPushToken` - Stores or updates a user's Expo push token in `user_push_tokens` table
- `unregisterPushToken` - Removes a push token from the database
- `getNotificationPreferences` - Retrieves user's notification preferences (summit_logging_notifications)
- `updateNotificationPreferences` - Updates user's notification preferences
- `sendSummitNotification` - Sends push notification when a summit is logged (checks preferences, fetches tokens, uses Expo Push API)

### User Helpers (`helpers/user/`)
- `addUserData` - Used in routes
- `addUserInterest` - Used in routes
- `createUser` - Used in routes
- `deleteUser` - Used in routes
- `getIsUserSubscribed` - Used in routes (note: filename typo `getIsUserSunscribed`)
- `getPublicUserProfile` - Used in routes
- `getUser` - Used in routes. Returns full user data including `is_public` field
- `getUserPrivacy` - Used in routes
- `getUserProfileStats` - Used in routes. Calculates aggregated profile statistics including: total peaks summited, total summits, highest peak, **lowest peak** (for elevation range), **most visited peak** (for favorites), challenges completed, total elevation gained, states/countries climbed, year-over-year stats, peak type breakdown (14ers, 13ers, etc.), and climbing streak (consecutive months with at least 1 summit).
- `getUserAcceptedChallenges` - Used in routes. Returns challenges the user has "accepted" (favorited). Parameters: `userId`, `includePrivate` (boolean), `includeCompleted` (boolean, default false). When `includeCompleted=true`, returns both in-progress and completed challenges with `is_completed` flag. Profile endpoint passes `includeCompleted=true` to show all favorited challenges.
- `getUserJournal` - Optimized single-query journal fetch. Returns paginated summit entries with inline peak data, inline activity context (title, distance, gain), summit numbers, and report status. Supports cursor pagination and filters (search, year, hasReport, peakId). Eliminates N+1 queries by including activity data in the main query.
- `updateUser` - Used in routes. Supports updating: `name`, `email`, `pic`, `city`, `state`, `country`, `location_coords` (converts [lng, lat] to PostGIS geography), `update_description`, `is_public`

### Billing Helpers (`helpers/billing/`)
- `createSubscription` - Used in routes
- `deleteSubscription` - Used in routes

### Historical Data Helpers (`helpers/historical-data/`)
- `addActivityMessages` - Used internally by `getUserHistoricalData`. Filters out non-GPS activities (indoor, virtual) at import time to save API calls. Calculates priority scores based on elevation gain, distance, and recency to process high-value activities first.
- `checkUserHistoricalData` - Used internally by `getUserHistoricalData`
- `getNextActivities` - Used internally by `getUserHistoricalData`
- `getUserHistoricalData` - Used in routes
- `setHistoricalDataFlag` - Used internally by `getUserHistoricalData`

### Import Status (`helpers/user/getImportStatus.ts`)
- `getImportStatus` - Returns detailed import progress: total/processed/pending activities, summits found, percent complete, estimated hours remaining, status, and user-friendly message. Used by `/users/:userId/import-status` endpoint.
- **Rate limit config**: `WEBHOOK_RESERVE_PERCENT = 0.02` (2% reserved for webhooks, matching queue-handler). With 30k daily limit: ~14,700 activities/day processing capacity.

### User Challenge Progress
- `GET /users/:userId/challenges/:challengeId` - Returns a user's progress on a specific challenge. Response includes:
  - `challenge`: Challenge details (name, region, num_peaks)
  - `progress`: User's progress (completed, total, lastProgressDate, lastProgressCount)
  - `peaks`: Array of peaks with `is_summited` and `summit_date` fields (only public summits)
  - `user`: User info (id, name, pic)
  - `isOwner`: Boolean indicating if requester owns this profile
  
  Respects user privacy settings - returns 404 for private users if not owner.

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
- `users` - User accounts (includes `summit_logging_notifications` boolean for push notification preferences)
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
- `summit_photos` - Photo metadata for summit reports (GCS-backed; supports activity + manual summits)
- `user_push_tokens` - Expo push tokens for mobile devices (user_id, token, platform, timestamps)

## External Integrations
- **Strava API**: Activity data, OAuth authentication
- **Google Maps Services**: Geocoding and mapping
- **Stripe**: Subscription billing
- **Google Cloud Pub/Sub**: Message queue for activity processing
- **Google Cloud Storage**: Private photo storage (signed URLs; thumbnails generated server-side)
- **Expo Push Notifications**: Mobile push notifications via Expo's push service

## Photo Storage Setup (GCS)

Photo uploads use a private Google Cloud Storage bucket with **signed URLs**.

### Bucket
- Suggested bucket name: `pathquest-photos`
- Region: same as Cloud SQL (latency)
- Public access: prevented (signed URLs only)

### CORS
Recommended CORS JSON:

```json
[
  {
    "origin": ["https://pathquest.app", "pathquest://"],
    "method": ["GET", "PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

### Service Account / IAM
`pathquest-api` needs permission to:
- Generate signed URLs
- Read uploaded originals
- Write thumbnails
- Delete objects on photo delete

Recommended role: **Storage Object Admin** on the bucket.

### Environment Variables
- `PHOTOS_BUCKET_NAME` (default: `pathquest-photos`)
- `PHOTOS_UPLOAD_URL_EXPIRES_MS` (default: `900000` / 15 min)
- `PHOTOS_VIEW_URL_EXPIRES_MS` (default: `3600000` / 1 hr)
- `PHOTOS_MAX_UPLOAD_BYTES` (default: `10485760` / 10MB)
- `PHOTOS_THUMB_WIDTH` (default: `400`)
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


