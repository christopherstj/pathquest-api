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

## Routes

### Root Route (`/`)
**Status**: UNUSED - Consider removing
- **Method**: GET
- **Purpose**: Fetches a Strava activity directly (legacy/test endpoint)
- **Query Params**: `userId`, `activityId`
- **Note**: This route is registered but likely not used by the frontend

### Auth Routes (`/auth`)
Handles user authentication and Strava credential management.

#### `POST /strava-creds`
- **Purpose**: Updates Strava credentials for a user
- **Body**: `StravaCreds` object
- **Helper**: `updateStravaCreds`

#### `POST /signup`
- **Purpose**: Creates a new user account and saves Strava credentials
- **Body**: User data + Strava credentials
- **Helpers**: `createUser`, `updateStravaCreds`, `addUserData`

#### `POST /user-interest`
- **Purpose**: Records user interest (email collection for waitlist/marketing)
- **Body**: `{ email: string }`
- **Helper**: `addUserInterest`

### User Routes (`/user`)
Manages user profiles and account operations.

#### `POST /user`
**Status**: UNUSED - Marked with comment "NOT USED - remove?"
- **Purpose**: Checks if a user exists
- **Body**: `{ id: string }`
- **Helper**: `getUser`
- **Note**: This endpoint appears to be unused. The GET endpoint below serves similar functionality.

#### `GET /user/:userId`
- **Purpose**: Gets user profile (private if requesting user matches, public otherwise)
- **Params**: `userId`
- **Query**: `requestingUserId` (optional)
- **Helpers**: `getUser`, `getPublicUserProfile`

#### `GET /user/:userId/activities-processing`
- **Purpose**: Gets count of activities currently being processed for a user
- **Params**: `userId`
- **Query**: `requestingUserId` (must match userId for authorization)
- **Helper**: `getActivitiesProcessing`

#### `GET /user/:userId/is-subscribed`
- **Purpose**: Checks if user has an active subscription
- **Params**: `userId`
- **Helper**: `getIsUserSubscribed`

#### `DELETE /user/:userId`
- **Purpose**: Deletes a user account
- **Params**: `userId`
- **Helper**: `deleteUser`

#### `PUT /user/:userId`
- **Purpose**: Updates user profile information
- **Params**: `userId`
- **Body**: `{ name?, email?, pic? }`
- **Helper**: `updateUser`

### Activities Routes (`/activities`)
Manages Strava activities and their associated peak summits.

#### `GET /activities/recent`
- **Purpose**: Gets most recent activities for a user
- **Query**: `userId`, `summitsOnly?` (boolean)
- **Helper**: `getMostRecentActivities`

#### `GET /activities/search/nearest`
- **Purpose**: Searches for activities nearest to a coordinate point
- **Query**: `userId`, `lat`, `lng`, `page?`, `search?`
- **Helper**: `searchNearestActivities`

#### `POST /activities/peak`
- **Purpose**: Gets all activities that summitted a specific peak
- **Body**: `{ userId, peakId }`
- **Helper**: `getActivitiesByPeak`

#### `GET /activities/:userId/:activityId`
- **Purpose**: Gets detailed activity information including peak summits
- **Params**: `userId`, `activityId`
- **Authorization**: Checks that userId matches activity owner
- **Helper**: `getActivityDetails`, `getActivityOwnerId`

#### `DELETE /activities/:userId/:activityId`
- **Purpose**: Deletes an activity
- **Params**: `userId`, `activityId`
- **Authorization**: Checks that userId matches activity owner
- **Helper**: `deleteActivity`, `getActivityOwnerId`

#### `GET /activities/:userId/:activityId/coords`
- **Purpose**: Gets coordinate data for an activity
- **Params**: `userId`, `activityId`
- **Authorization**: Checks that userId matches activity owner
- **Helper**: `getCoordsByActivity`, `getActivityOwnerId`

#### `GET /activities/search`
- **Purpose**: Searches activities with optional bounding box and search term
- **Query**: `userId`, `northWestLat?`, `northWestLng?`, `southEastLat?`, `southEastLng?`, `search?`
- **Helper**: `searchActivities`

#### `POST /activities/reprocess`
- **Purpose**: Triggers reprocessing of an activity to recalculate peak summits
- **Body**: `{ userId, activityId }`
- **Authorization**: Checks that userId matches activity owner
- **Helper**: `reprocessActivity`, `getActivityOwnerId`

### Peaks Routes (`/peaks`)
Manages mountain peaks, summits, and user interactions with peaks.

#### `GET /peaks`
- **Purpose**: Gets paginated list of peaks
- **Query**: `page?`, `perPage?`, `search?`
- **Helper**: `getPeaks`

#### `GET /peaks/search`
- **Purpose**: Searches peaks with optional bounding box, search term, and user-specific filters
- **Query**: `northWestLat?`, `northWestLng?`, `southEastLat?`, `southEastLng?`, `page?`, `perPage?`, `search?`, `userId?`, `showSummittedPeaks?`
- **Helper**: `searchPeaks`

#### `GET /peaks/search/nearest`
- **Purpose**: Finds peaks nearest to a coordinate point
- **Query**: `userId`, `lat`, `lng`, `page?`, `search?`
- **Helper**: `searchNearestPeaks`

#### `GET /peaks/:id`
- **Purpose**: Gets detailed peak information including summits, activities, and challenges
- **Params**: `id`
- **Query**: `userId` (optional)
- **Helpers**: `getPeakById`, `getPublicSummitsByPeak`, `getChallengesByPeak`, `getActivitiesByPeak`, `getSummitsByPeak`

#### `GET /peaks/summits/:userId`
- **Purpose**: Gets all peaks summitted by a user
- **Params**: `userId`
- **Query**: `requestingUserId?` (if matches userId, includes private summits)
- **Helper**: `getPeakSummitsByUser`

#### `GET /peaks/summits/unclimbed/nearest`
- **Purpose**: Gets nearest unclimbed peaks for a user
- **Query**: `userId`
- **Helper**: `getNearestUnclimbedPeaks`

#### `GET /peaks/summits/unclimbed`
- **Purpose**: Gets unclimbed peaks within bounds or matching search
- **Query**: `userId`, `northWestLat?`, `northWestLng?`, `southEastLat?`, `southEastLng?`, `search?`, `showSummittedPeaks?`
- **Helper**: `getUnclimbedPeaks`

#### `POST /peaks/summits/manual`
- **Purpose**: Adds a manual peak summit entry (not from Strava activity)
- **Body**: `ManualPeakSummit`
- **Helper**: `addManualPeakSummit`

#### `POST /peaks/summits/favorite`
- **Purpose**: Gets user's favorite peaks
- **Body**: `{ userId }`
- **Helper**: `getFavoritePeaks`

#### `GET /peaks/summits/recent`
- **Purpose**: Gets recent summits for a user
- **Query**: `userId`
- **Helper**: `getRecentSummits`

#### `PUT /peaks/favorite`
- **Purpose**: Toggles favorite status for a peak
- **Body**: `{ newValue: boolean, userId, peakId }`
- **Helpers**: `addFavoritePeak`, `removeFavoritePeak`

#### `GET /peaks/favorite`
- **Purpose**: Checks if a peak is favorited by a user
- **Query**: `userId`, `peakId`
- **Helper**: `getIsPeakFavorited`

#### `GET /peaks/ascent/:ascentId`
- **Purpose**: Gets detailed ascent information
- **Params**: `ascentId`
- **Query**: `userId`
- **Helpers**: `getAscentDetails`, `getPeakById`, `getSummitsByPeak`

#### `PUT /peaks/ascent/:ascentId`
- **Purpose**: Updates an ascent (notes, visibility, etc.)
- **Params**: `ascentId`
- **Query**: `userId`
- **Body**: `{ ascent: AscentDetail }`
- **Authorization**: Checks that userId matches ascent owner
- **Helpers**: `updateAscent`, `getAscentOwnerId`

#### `DELETE /peaks/ascent/:ascentId`
- **Purpose**: Deletes an ascent
- **Params**: `ascentId`
- **Query**: `userId`
- **Authorization**: Checks that userId matches ascent owner
- **Helpers**: `deleteAscent`, `getAscentOwnerId`

### Challenges Routes (`/challenges`)
Manages mountain climbing challenges (e.g., Colorado 14ers, NH 4000 footers).

#### `POST /challenges/incomplete`
- **Purpose**: Gets challenges that are not completed by a user
- **Body**: `{ userId }`
- **Helper**: `getUncompletedChallenges`

#### `GET /challenges`
- **Purpose**: Gets paginated list of challenges
- **Query**: `page?`, `perPage?`, `search?`
- **Helper**: `getChallenges`

#### `GET /challenges/:challengeId/details`
- **Purpose**: Gets detailed challenge information including peaks and user progress
- **Params**: `challengeId`
- **Query**: `userId`
- **Helpers**: `getChallengeByUserAndId`, `getPeaksByChallenge`, `getMostRecentSummitByPeak`

#### `GET /challenges/search`
- **Purpose**: Searches challenges with filters for type, bounds, search term, and favorites
- **Query**: `userId`, `type` (comma-separated: "completed,in-progress,not-started"), `northWestLat?`, `northWestLng?`, `southEastLat?`, `southEastLng?`, `search?`, `favoritesOnly?`
- **Helper**: `getAllChallenges`

#### `POST /challenges/favorite`
- **Purpose**: Adds a challenge to user's favorites
- **Body**: `{ userId, challengeId }`
- **Helpers**: `getUserPrivacy`, `addChallengeFavorite`

#### `PUT /challenges/favorite`
- **Purpose**: Updates challenge favorite privacy setting
- **Body**: `UserChallengeFavorite`
- **Helper**: `updateChallengePrivacy`

#### `DELETE /challenges/favorite/:userId/:challengeId`
- **Purpose**: Removes a challenge from user's favorites
- **Params**: `userId`, `challengeId`
- **Helper**: `deleteChallengeFavorite`

### Billing Routes (`/billing`)
Manages Stripe subscription operations.

#### `POST /billing/create-subscription`
- **Purpose**: Creates a new Stripe subscription for a user
- **Body**: `{ userId, email, stripeUserId }`
- **Helper**: `createSubscription`

#### `POST /billing/delete-subscription`
- **Purpose**: Cancels a Stripe subscription
- **Body**: `{ stripeUserId? }`
- **Helper**: `deleteSubscription`

### Historical Data Routes (`/historical-data`)
Handles processing of historical Strava activities for new users.

#### `POST /historical-data`
- **Purpose**: Initiates processing of user's historical Strava activities
- **Body**: `{ userId }`
- **Helper**: `getUserHistoricalData`
- **Note**: Returns immediately, processing happens asynchronously

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

