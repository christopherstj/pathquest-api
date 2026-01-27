import getCloudSqlConnection from "../getCloudSqlConnection";
import { getPrimaryExpansion, stripFillerWords } from "./expandSearchTerm";
import convertPgNumbers from "../convertPgNumbers";
import {
  UnifiedSearchResponse,
  PeakSearchResult,
  ChallengeSearchResult,
  RelevancyFactors,
} from "../../typeDefs/UnifiedSearchResult";

/**
 * Relevancy weight configuration for Phase 1
 * These can be tuned based on user feedback
 */
const RELEVANCY_WEIGHTS = {
  textMatch: 0.35, // Text match quality (exact, prefix, contains, fuzzy)
  geoProximity: 0.30, // Distance from search center
  publicPopularity: 0.25, // Public summit count / activity
  personalRelevance: 0.10, // User's own data (summits, favorites)
  challengeMembership: 0.00, // Number of challenges (disabled for Phase 1)
};

/**
 * Viewport boost multiplier for results within the current map bounds
 */
const VIEWPORT_BOOST = 1.3;

/**
 * Maximum distance in meters for geographic relevancy scoring
 * Results beyond this distance get minimal geo score
 */
const MAX_GEO_DISTANCE_METERS = 500000; // 500km

/**
 * Maximum public summits for normalization
 * Peaks with this many or more summits get max popularity score
 */
const MAX_PUBLIC_SUMMITS_FOR_NORMALIZATION = 500;

/**
 * Maximum challenge count for normalization
 */
const MAX_CHALLENGES_FOR_NORMALIZATION = 10;

/**
 * State abbreviation to full name mapping for search expansion
 */
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

export interface UnifiedSearchOptions {
  query: string;
  lat?: number;
  lng?: number;
  bounds?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  limit?: number;
  includePeaks?: boolean;
  includeChallenges?: boolean;
  userId?: string;
}

/**
 * Unified search with relevancy scoring
 * Combines peaks and challenges into a single ranked result set
 */
const unifiedSearch = async (
  options: UnifiedSearchOptions
): Promise<UnifiedSearchResponse> => {
  const {
    query,
    lat,
    lng,
    bounds,
    limit = 20,
    includePeaks = true,
    includeChallenges = true,
    userId,
  } = options;

  const db = await getCloudSqlConnection();

  // Expand search term (e.g., "mt" -> "mount")
  const expandedQuery = getPrimaryExpansion(query);
  // Strip filler words for similarity matching
  const strippedQuery = stripFillerWords(expandedQuery);

  const results: (PeakSearchResult | ChallengeSearchResult)[] = [];
  let totalPeaks = 0;
  let totalChallenges = 0;

  // Search peaks and challenges in parallel
  const searchPromises: Promise<void>[] = [];

  if (includePeaks) {
    searchPromises.push(
      searchPeaksWithRelevancy(
        db,
        expandedQuery,
        strippedQuery,
        lat,
        lng,
        bounds,
        userId,
        limit
      ).then((peakResults) => {
        results.push(...peakResults.results);
        totalPeaks = peakResults.total;
      })
    );
  }

  if (includeChallenges) {
    searchPromises.push(
      searchChallengesWithRelevancy(
        db,
        expandedQuery,
        lat,
        lng,
        bounds,
        userId,
        limit
      ).then((challengeResults) => {
        results.push(...challengeResults.results);
        totalChallenges = challengeResults.total;
      })
    );
  }

  await Promise.all(searchPromises);

  // Sort all results by relevancy score
  results.sort((a, b) => b.relevancyScore - a.relevancyScore);

  // Return top N results
  return {
    results: results.slice(0, limit),
    totalPeaks,
    totalChallenges,
  };
};

/**
 * Search peaks with relevancy scoring
 * Optimized for performance using trigram GiST index
 */
async function searchPeaksWithRelevancy(
  db: Awaited<ReturnType<typeof getCloudSqlConnection>>,
  expandedQuery: string,
  strippedQuery: string,
  lat: number | undefined,
  lng: number | undefined,
  bounds: [number, number, number, number] | undefined,
  userId: string | undefined,
  limit: number
): Promise<{ results: PeakSearchResult[]; total: number }> {
  // Build params array
  const params: (string | number)[] = [];
  let paramIndex = 1;

  // Search query param (for trigram similarity - uses GiST index)
  const searchParamIndex = paramIndex++;
  params.push(expandedQuery);

  // Stripped query for fallback similarity (if different)
  let strippedParamIndex: number | undefined;
  const useStrippedSimilarity =
    strippedQuery && strippedQuery !== expandedQuery && strippedQuery.length > 0;
  if (useStrippedSimilarity) {
    strippedParamIndex = paramIndex++;
    params.push(strippedQuery);
  }

  // Geo params for distance calculation
  let geoLngParamIndex: number | undefined;
  let geoLatParamIndex: number | undefined;
  if (lat !== undefined && lng !== undefined) {
    geoLngParamIndex = paramIndex++;
    geoLatParamIndex = paramIndex++;
    params.push(lng, lat);
  }

  // Bounds params for viewport boost
  let boundsParamStart: number | undefined;
  if (bounds) {
    boundsParamStart = paramIndex;
    params.push(bounds[0], bounds[1], bounds[2], bounds[3]);
    paramIndex += 4;
  }

  // User ID param
  let userIdParamIndex: number | undefined;
  if (userId) {
    userIdParamIndex = paramIndex++;
    params.push(userId);
  }

  // Limit param - fetch more to allow for relevancy sorting
  const limitParamIndex = paramIndex++;
  params.push(limit * 3);

  // Build the optimized query
  // Key optimization: Use ONLY trigram similarity (%) in WHERE clause
  // This allows PostgreSQL to use the GiST trigram index efficiently
  const query = `
    SELECT 
      p.id,
      p.name,
      p.elevation,
      p.county,
      p.state,
      p.country,
      ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
      -- Get public summits count (subquery is faster than CTE for small result sets)
      COALESCE((
        SELECT COUNT(DISTINCT sub.id)
        FROM (
          SELECT ap.id FROM activities_peaks ap
          INNER JOIN activities a ON a.id = ap.activity_id
          INNER JOIN users u ON u.id = a.user_id
          WHERE ap.peak_id = p.id AND ap.is_public = true AND u.is_public = true
          AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
          UNION
          SELECT upm.id FROM user_peak_manual upm
          INNER JOIN users u ON u.id = upm.user_id
          WHERE upm.peak_id = p.id AND upm.is_public = true AND u.is_public = true
        ) sub
      ), 0)::int AS public_summits,
      -- Get challenge count
      COALESCE((SELECT COUNT(*) FROM peaks_challenges pc WHERE pc.peak_id = p.id), 0)::int AS num_challenges,
      ${userId ? `
      -- User's summit count
      COALESCE((
        SELECT COUNT(*) FROM (
          SELECT ap.id FROM activities_peaks ap
          INNER JOIN activities a ON a.id = ap.activity_id
          WHERE ap.peak_id = p.id AND a.user_id = $${userIdParamIndex}
          AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
          UNION ALL
          SELECT upm.id FROM user_peak_manual upm
          WHERE upm.peak_id = p.id AND upm.user_id = $${userIdParamIndex}
        ) s
      ), 0)::int AS user_summits,
      -- Is favorited
      EXISTS(SELECT 1 FROM user_peak_favorite upf WHERE upf.peak_id = p.id AND upf.user_id = $${userIdParamIndex}) AS is_favorited,
      ` : ""}
      -- Text match scoring using trigram similarity
      -- Higher scores for better matches
      GREATEST(
        similarity(p.name, $${searchParamIndex}),
        ${useStrippedSimilarity && strippedParamIndex ? `similarity(p.name, $${strippedParamIndex}),` : ""}
        -- Boost exact matches
        CASE WHEN LOWER(p.name) = LOWER($${searchParamIndex}) THEN 1.0 ELSE 0 END,
        -- Boost prefix matches
        CASE WHEN LOWER(p.name) LIKE LOWER($${searchParamIndex}) || '%' THEN 0.9 ELSE 0 END
      ) AS text_score,
      -- Geo proximity scoring (0-1 based on distance)
      ${
        geoLngParamIndex && geoLatParamIndex
          ? `GREATEST(0, 1.0 - (ST_Distance(
              p.location_coords::geography, 
              ST_MakePoint($${geoLngParamIndex}, $${geoLatParamIndex})::geography
            ) / ${MAX_GEO_DISTANCE_METERS})) AS geo_score`
          : "0.5 AS geo_score"
      },
      -- Viewport boost
      ${
        boundsParamStart
          ? `CASE WHEN p.location_coords && ST_MakeEnvelope($${boundsParamStart}, $${boundsParamStart + 1}, $${boundsParamStart + 2}, $${boundsParamStart + 3}, 4326)::geography 
             THEN ${VIEWPORT_BOOST} ELSE 1.0 END AS viewport_boost`
          : "1.0 AS viewport_boost"
      }
    FROM peaks p
    WHERE p.name % $${searchParamIndex}
    ORDER BY 
      similarity(p.name, $${searchParamIndex}) DESC,
      p.elevation DESC NULLS LAST
    LIMIT $${limitParamIndex}
  `;

  const rows = (await db.query(query, params)).rows;

  // Map to PeakSearchResult and calculate final relevancy scores
  const results: PeakSearchResult[] = convertPgNumbers(rows).map(
    (row: Record<string, unknown>) => {
      // Calculate individual relevancy factors
      const textMatch = row.text_score as number;
      const geoProximity = row.geo_score as number;
      const publicPopularity = Math.min(
        1.0,
        (row.public_summits as number) / MAX_PUBLIC_SUMMITS_FOR_NORMALIZATION
      );
      const personalRelevance =
        (row.is_favorited || (row.user_summits as number) > 0) ? 1.0 : 0;
      const challengeMembership = Math.min(
        1.0,
        (row.num_challenges as number) / MAX_CHALLENGES_FOR_NORMALIZATION
      );

      // Calculate composite score
      const relevancyScore =
        (textMatch * RELEVANCY_WEIGHTS.textMatch +
          geoProximity * RELEVANCY_WEIGHTS.geoProximity +
          publicPopularity * RELEVANCY_WEIGHTS.publicPopularity +
          personalRelevance * RELEVANCY_WEIGHTS.personalRelevance +
          challengeMembership * RELEVANCY_WEIGHTS.challengeMembership) *
        (row.viewport_boost as number);

      const relevancyFactors: RelevancyFactors = {
        textMatch,
        geoProximity,
        publicPopularity,
        personalRelevance,
        challengeMembership,
      };

      return {
        type: "peak" as const,
        id: row.id as string,
        name: row.name as string,
        elevation: row.elevation as number | undefined,
        county: row.county as string | undefined,
        state: row.state as string | undefined,
        country: row.country as string | undefined,
        location_coords: row.location_coords as [number, number] | undefined,
        publicSummits: row.public_summits as number,
        userSummits: row.user_summits as number | undefined,
        numChallenges: row.num_challenges as number,
        isFavorited: row.is_favorited as boolean | undefined,
        relevancyScore,
        relevancyFactors,
      };
    }
  );

  // Sort by final relevancy score
  results.sort((a, b) => b.relevancyScore - a.relevancyScore);

  return { results: results.slice(0, limit), total: results.length };
}

/**
 * Search challenges with relevancy scoring
 */
async function searchChallengesWithRelevancy(
  db: Awaited<ReturnType<typeof getCloudSqlConnection>>,
  expandedQuery: string,
  lat: number | undefined,
  lng: number | undefined,
  bounds: [number, number, number, number] | undefined,
  userId: string | undefined,
  limit: number
): Promise<{ results: ChallengeSearchResult[]; total: number }> {
  // Build params array
  const params: (string | number)[] = [];
  let paramIndex = 1;

  // Search query params
  const searchPatternParamIndex = paramIndex++;
  params.push(`%${expandedQuery}%`);

  // Geo params for distance calculation
  let geoLngParamIndex: number | undefined;
  let geoLatParamIndex: number | undefined;
  if (lat !== undefined && lng !== undefined) {
    geoLngParamIndex = paramIndex++;
    geoLatParamIndex = paramIndex++;
    params.push(lng, lat);
  }

  // Bounds params for viewport boost
  let boundsParamStart: number | undefined;
  if (bounds) {
    boundsParamStart = paramIndex;
    params.push(bounds[0], bounds[1], bounds[2], bounds[3]);
    paramIndex += 4;
  }

  // User ID param
  let userIdParamIndex: number | undefined;
  if (userId) {
    userIdParamIndex = paramIndex++;
    params.push(userId);
  }

  // Limit param
  const limitParamIndex = paramIndex++;
  params.push(limit * 2);

  // Build the query - challenges table is small, so ILIKE is fine
  const query = `
    SELECT 
      c.id,
      c.name,
      c.region,
      ST_Y(c.location_coords::geometry) AS center_lat,
      ST_X(c.location_coords::geometry) AS center_long,
      (SELECT COUNT(*) FROM peaks_challenges pc WHERE pc.challenge_id = c.id)::int AS num_peaks,
      ${userId ? `
      COALESCE((
        SELECT COUNT(DISTINCT s.peak_id) FROM peaks_challenges pc
        LEFT JOIN (
          SELECT DISTINCT peak_id FROM (
            SELECT ap.peak_id FROM activities_peaks ap
            INNER JOIN activities a ON a.id = ap.activity_id
            WHERE a.user_id = $${userIdParamIndex}
            AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION
            SELECT peak_id FROM user_peak_manual WHERE user_id = $${userIdParamIndex}
          ) all_summits
        ) s ON pc.peak_id = s.peak_id
        WHERE pc.challenge_id = c.id
      ), 0)::int AS user_completed,
      EXISTS(SELECT 1 FROM user_challenge_favorite ucf WHERE ucf.challenge_id = c.id AND ucf.user_id = $${userIdParamIndex}) AS is_favorited,
      ` : ""}
      -- Text match scoring
      CASE WHEN LOWER(c.name) ILIKE $${searchPatternParamIndex} THEN 0.8
           WHEN LOWER(c.region) ILIKE $${searchPatternParamIndex} THEN 0.5
           ELSE 0.3
      END AS text_score,
      -- Geo proximity scoring
      ${
        geoLngParamIndex && geoLatParamIndex
          ? `GREATEST(0, 1.0 - (ST_Distance(
              c.location_coords::geography, 
              ST_MakePoint($${geoLngParamIndex}, $${geoLatParamIndex})::geography
            ) / ${MAX_GEO_DISTANCE_METERS})) AS geo_score`
          : "0.5 AS geo_score"
      },
      -- Viewport boost
      ${
        boundsParamStart
          ? `CASE WHEN EXISTS (
              SELECT 1 FROM peaks_challenges pc
              INNER JOIN peaks p ON pc.peak_id = p.id
              WHERE pc.challenge_id = c.id
              AND p.location_coords && ST_MakeEnvelope($${boundsParamStart}, $${boundsParamStart + 1}, $${boundsParamStart + 2}, $${boundsParamStart + 3}, 4326)::geography
            ) THEN ${VIEWPORT_BOOST} ELSE 1.0 END AS viewport_boost`
          : "1.0 AS viewport_boost"
      }
    FROM challenges c
    WHERE c.name ILIKE $${searchPatternParamIndex}
       OR c.region ILIKE $${searchPatternParamIndex}
    ORDER BY 
      CASE WHEN LOWER(c.name) ILIKE $${searchPatternParamIndex} THEN 1 ELSE 2 END,
      c.name ASC
    LIMIT $${limitParamIndex}
  `;

  const rows = (await db.query(query, params)).rows;

  // Map to ChallengeSearchResult
  const results: ChallengeSearchResult[] = rows.map(
    (row: Record<string, unknown>) => {
      // Calculate individual relevancy factors
      const textMatch = row.text_score as number;
      const geoProximity = row.geo_score as number;
      const publicPopularity = 0; // Not tracking for challenges in simplified version
      const personalRelevance = row.is_favorited ? 1.0 : 0;
      const challengeMembership = 0;

      // Calculate composite score
      const relevancyScore =
        (textMatch * RELEVANCY_WEIGHTS.textMatch +
          geoProximity * RELEVANCY_WEIGHTS.geoProximity +
          publicPopularity * RELEVANCY_WEIGHTS.publicPopularity +
          personalRelevance * RELEVANCY_WEIGHTS.personalRelevance +
          challengeMembership * RELEVANCY_WEIGHTS.challengeMembership) *
        (row.viewport_boost as number);

      const relevancyFactors: RelevancyFactors = {
        textMatch,
        geoProximity,
        publicPopularity,
        personalRelevance,
        challengeMembership,
      };

      return {
        type: "challenge" as const,
        id: String(row.id),
        name: row.name as string,
        region: row.region as string | undefined,
        center_lat: row.center_lat as number | undefined,
        center_long: row.center_long as number | undefined,
        numPeaks: row.num_peaks as number,
        userCompleted: row.user_completed as number | undefined,
        isFavorited: row.is_favorited as boolean | undefined,
        relevancyScore,
        relevancyFactors,
      };
    }
  );

  return { results, total: results.length };
}

export default unifiedSearch;
