import { FastifyInstance } from "fastify";
import getCloudSqlConnection from "../helpers/getCloudSqlConnection";
import getCurrentWeather from "../helpers/peaks/getCurrentWeather";

// Weather code to summary mapping (WMO codes)
const weatherCodeToSummary: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
};

const weatherCodeToIcon: Record<number, string> = {
    0: "clear",
    1: "mostly_clear",
    2: "partly_cloudy",
    3: "overcast",
    45: "fog",
    48: "fog",
    51: "drizzle",
    53: "drizzle",
    55: "drizzle",
    61: "rain",
    63: "rain",
    65: "heavy_rain",
    66: "freezing_rain",
    67: "freezing_rain",
    71: "snow",
    73: "snow",
    75: "heavy_snow",
    77: "snow",
    80: "rain_showers",
    81: "rain_showers",
    82: "rain_showers",
    85: "snow_showers",
    86: "snow_showers",
    95: "thunderstorm",
    96: "thunderstorm",
    99: "thunderstorm",
};

export interface DashboardStats {
    totalPeaks: number;
    totalElevationGained: number; // in meters
    summitsThisMonth: number;
    summitsLastMonth: number;
    primaryChallengeProgress: {
        challengeId: number;
        name: string;
        completed: number;
        total: number;
    } | null;
}

export interface SuggestedPeakWeather {
    summary: string;
    temp_f: number | null;
    feels_like_f: number | null;
    wind_mph: number | null;
    precipitation_mm: number | null;
    conditions_icon: string;
}

export interface SuggestedPeak {
    peak_id: string;
    peak_name: string;
    peak_elevation: number; // meters
    peak_coords: { lat: number; lng: number };
    distance_miles: number;
    suggestion_type: 'challenge' | 'explore'; // 'challenge' = from favorited challenge, 'explore' = nearby tall peak
    challenge_id: string | null;
    challenge_name: string | null;
    challenge_remaining: number | null;
    weather: SuggestedPeakWeather;
}

/**
 * Haversine formula to calculate distance between two lat/lng points.
 * Returns distance in miles.
 */
const haversineDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Celsius to Fahrenheit conversion
 */
const celsiusToFahrenheit = (celsius: number | null): number | null => {
    if (celsius === null) return null;
    return Math.round((celsius * 9) / 5 + 32);
};

/**
 * km/h to mph conversion
 */
const kmhToMph = (kmh: number | null): number | null => {
    if (kmh === null) return null;
    return Math.round(kmh * 0.621371);
};

/**
 * Get the closest unclimbed peak from user's favorited challenges.
 */
const getSuggestedPeak = async (
    userId: string,
    userLat: number,
    userLng: number,
    maxDistanceMiles: number = 100
): Promise<SuggestedPeak | null> => {
    const db = await getCloudSqlConnection();

    // Query: Get all unclimbed peaks from user's favorited challenges
    // with their distance from the user's location
    const query = `
        WITH user_summited_peaks AS (
            SELECT DISTINCT ap.peak_id
            FROM (
                SELECT a.user_id, ap.peak_id 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, peak_id 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1
        ),
        favorite_challenges AS (
            SELECT c.id, c.name
            FROM challenges c
            INNER JOIN user_challenge_favorite ucf ON c.id = ucf.challenge_id
            WHERE ucf.user_id = $1
        ),
        challenge_peaks AS (
            SELECT 
                fc.id AS challenge_id,
                fc.name AS challenge_name,
                p.id AS peak_id,
                p.name AS peak_name,
                p.elevation,
                ST_Y(p.location_coords::geometry) AS lat,
                ST_X(p.location_coords::geometry) AS lng,
                (SELECT COUNT(*) FROM peaks_challenges pc2 
                 LEFT JOIN user_summited_peaks usp ON pc2.peak_id = usp.peak_id
                 WHERE pc2.challenge_id = fc.id AND usp.peak_id IS NULL) AS challenge_remaining
            FROM favorite_challenges fc
            INNER JOIN peaks_challenges pc ON pc.challenge_id = fc.id
            INNER JOIN peaks p ON p.id = pc.peak_id
            LEFT JOIN user_summited_peaks usp ON p.id = usp.peak_id
            WHERE usp.peak_id IS NULL
            AND p.location_coords IS NOT NULL
        )
        SELECT 
            challenge_id,
            challenge_name,
            peak_id,
            peak_name,
            elevation,
            lat,
            lng,
            challenge_remaining
        FROM challenge_peaks
    `;

    const result = await db.query(query, [userId]);

    console.log(`[getSuggestedPeak] User ${userId}, coords: ${userLat}, ${userLng}`);
    console.log(`[getSuggestedPeak] Found ${result.rows.length} unclimbed peaks from favorited challenges`);

    // Calculate distances and filter by max distance for challenge peaks
    type PeakCandidate = {
        challenge_id: string | null;
        challenge_name: string | null;
        peak_id: string;
        peak_name: string;
        elevation: number;
        lat: number;
        lng: number;
        challenge_remaining: number | null;
        distance_miles: number;
    };

    const challengeCandidates: PeakCandidate[] = result.rows
        .map((row: any) => ({
            challenge_id: String(row.challenge_id),
            challenge_name: row.challenge_name,
            peak_id: String(row.peak_id),
            peak_name: row.peak_name,
            elevation: parseFloat(row.elevation) || 0,
            lat: parseFloat(row.lat),
            lng: parseFloat(row.lng),
            challenge_remaining: parseInt(row.challenge_remaining) || 0,
            distance_miles: haversineDistance(
                userLat,
                userLng,
                parseFloat(row.lat),
                parseFloat(row.lng)
            ),
        }))
        .filter((c: PeakCandidate) => c.distance_miles <= maxDistanceMiles)
        .sort((a: PeakCandidate, b: PeakCandidate) => a.distance_miles - b.distance_miles);

    console.log(`[getSuggestedPeak] ${challengeCandidates.length}/${result.rows.length} challenge peaks within ${maxDistanceMiles} miles`);

    let selectedPeak: PeakCandidate | null = null;
    let suggestionType: 'challenge' | 'explore' = 'challenge';

    if (challengeCandidates.length > 0) {
        // Use closest challenge peak
        selectedPeak = challengeCandidates[0];
        suggestionType = 'challenge';
        console.log(`[getSuggestedPeak] Selected challenge peak: ${selectedPeak.peak_name} at ${selectedPeak.distance_miles.toFixed(1)} mi`);
    } else {
        // Fallback: Find highest peak nearby (explore suggestion)
        console.log(`[getSuggestedPeak] No challenge peaks nearby, falling back to explore suggestion`);
        
        // Query peaks near user's location using PostGIS distance
        const exploreQuery = `
            SELECT 
                p.id AS peak_id,
                p.name AS peak_name,
                p.elevation,
                ST_Y(p.location_coords::geometry) AS lat,
                ST_X(p.location_coords::geometry) AS lng,
                ST_Distance(
                    p.location_coords::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) / 1609.34 AS distance_miles
            FROM peaks p
            WHERE p.location_coords IS NOT NULL
            AND p.elevation > 300  -- Peaks above ~1000ft
            AND ST_DWithin(
                p.location_coords::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3 * 1609.34  -- Convert miles to meters
            )
            ORDER BY p.elevation DESC
            LIMIT 10
        `;
        
        const exploreResult = await db.query(exploreQuery, [userLng, userLat, maxDistanceMiles]);
        
        console.log(`[getSuggestedPeak] Explore query found ${exploreResult.rows.length} peaks within ${maxDistanceMiles} miles`);
        
        if (exploreResult.rows.length > 0) {
            const row = exploreResult.rows[0];
            selectedPeak = {
                challenge_id: null,
                challenge_name: null,
                peak_id: String(row.peak_id),
                peak_name: row.peak_name,
                elevation: parseFloat(row.elevation) || 0,
                lat: parseFloat(row.lat),
                lng: parseFloat(row.lng),
                challenge_remaining: null,
                distance_miles: parseFloat(row.distance_miles) || 0,
            };
            suggestionType = 'explore';
            console.log(`[getSuggestedPeak] Selected explore peak: ${selectedPeak.peak_name} (${selectedPeak.elevation}m) at ${selectedPeak.distance_miles.toFixed(1)} mi`);
        }
    }

    if (!selectedPeak) {
        console.log(`[getSuggestedPeak] No peaks found within ${maxDistanceMiles} miles`);
        return null;
    }

    // Fetch weather for the selected peak
    const weather = await getCurrentWeather(
        { lat: selectedPeak.lat, lon: selectedPeak.lng },
        selectedPeak.elevation
    );

    const weatherSummary =
        weather.weatherCode !== null
            ? weatherCodeToSummary[weather.weatherCode] || "Unknown"
            : "Unknown";

    const weatherIcon =
        weather.weatherCode !== null
            ? weatherCodeToIcon[weather.weatherCode] || "unknown"
            : "unknown";

    return {
        peak_id: selectedPeak.peak_id,
        peak_name: selectedPeak.peak_name,
        peak_elevation: selectedPeak.elevation,
        peak_coords: { lat: selectedPeak.lat, lng: selectedPeak.lng },
        distance_miles: Math.round(selectedPeak.distance_miles * 10) / 10, // 1 decimal
        suggestion_type: suggestionType,
        challenge_id: selectedPeak.challenge_id,
        challenge_name: selectedPeak.challenge_name,
        challenge_remaining: selectedPeak.challenge_remaining,
        weather: {
            summary: weatherSummary,
            temp_f: celsiusToFahrenheit(weather.temperature),
            feels_like_f: celsiusToFahrenheit(weather.feelsLike),
            wind_mph: kmhToMph(weather.windSpeed),
            precipitation_mm: weather.precipitation,
            conditions_icon: weatherIcon,
        },
    };
};

const getDashboardStats = async (userId: string): Promise<DashboardStats> => {
    const db = await getCloudSqlConnection();

    // Get current month start and last month start/end
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Main query for aggregated stats
    const statsQuery = `
        WITH user_summits AS (
            SELECT ap.peak_id, ap.timestamp
            FROM (
                SELECT a.user_id, ap.timestamp, ap.peak_id 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, timestamp, peak_id 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1
        ),
        distinct_peaks AS (
            SELECT DISTINCT us.peak_id, p.elevation
            FROM user_summits us
            LEFT JOIN peaks p ON us.peak_id = p.id
        )
        SELECT 
            COUNT(DISTINCT dp.peak_id) AS total_peaks,
            COALESCE(SUM(dp.elevation), 0) AS total_elevation,
            (SELECT COUNT(*) FROM user_summits WHERE timestamp >= $2) AS summits_this_month,
            (SELECT COUNT(*) FROM user_summits WHERE timestamp >= $3 AND timestamp <= $4) AS summits_last_month
        FROM distinct_peaks dp
    `;

    const statsResult = await db.query(statsQuery, [
        userId,
        currentMonthStart.toISOString(),
        lastMonthStart.toISOString(),
        lastMonthEnd.toISOString(),
    ]);
    const stats = statsResult.rows[0];

    // Get primary challenge (favorite challenge with highest progress percentage, excluding completed)
    const primaryChallengeQuery = `
        SELECT 
            c.id AS challenge_id,
            c.name,
            COUNT(p.id) AS total,
            COUNT(ap2.summitted) AS completed,
            CASE WHEN COUNT(p.id) > 0 
                THEN (COUNT(ap2.summitted)::float / COUNT(p.id)::float) 
                ELSE 0 
            END AS progress_pct
        FROM challenges c
        INNER JOIN user_challenge_favorite ucf ON c.id = ucf.challenge_id
        LEFT JOIN peaks_challenges pc ON pc.challenge_id = c.id
        LEFT JOIN peaks p ON pc.peak_id = p.id
        LEFT JOIN (
            SELECT ap.peak_id, COUNT(ap.peak_id) > 0 AS summitted 
            FROM (
                SELECT a.user_id, ap.peak_id 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, peak_id 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1
            GROUP BY ap.peak_id
        ) ap2 ON p.id = ap2.peak_id
        WHERE ucf.user_id = $1
        GROUP BY c.id, c.name
        HAVING COUNT(ap2.summitted) < COUNT(p.id)
        ORDER BY progress_pct DESC, completed DESC
        LIMIT 1
    `;

    const primaryChallengeResult = await db.query(primaryChallengeQuery, [userId]);
    const primaryChallenge = primaryChallengeResult.rows[0];

    return {
        totalPeaks: parseInt(stats.total_peaks) || 0,
        totalElevationGained: parseFloat(stats.total_elevation) || 0,
        summitsThisMonth: parseInt(stats.summits_this_month) || 0,
        summitsLastMonth: parseInt(stats.summits_last_month) || 0,
        primaryChallengeProgress: primaryChallenge
            ? {
                  challengeId: parseInt(primaryChallenge.challenge_id),
                  name: primaryChallenge.name,
                  completed: parseInt(primaryChallenge.completed) || 0,
                  total: parseInt(primaryChallenge.total) || 0,
              }
            : null,
    };
};

const dashboard = (fastify: FastifyInstance, _: any, done: any) => {
    // Get dashboard stats for authenticated user
    fastify.get(
        "/stats",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const stats = await getDashboardStats(userId);
            reply.code(200).send(stats);
        }
    );

    // Get suggested next peak from user's favorited challenges
    fastify.get<{
        Querystring: {
            lat: string;
            lng: string;
            maxDistanceMiles?: string;
        };
    }>(
        "/suggested-peak",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const { lat, lng, maxDistanceMiles } = request.query;

            if (!lat || !lng) {
                reply.code(400).send({ message: "lat and lng are required" });
                return;
            }

            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);

            if (isNaN(userLat) || isNaN(userLng)) {
                reply.code(400).send({ message: "Invalid lat or lng" });
                return;
            }

            const maxDist = maxDistanceMiles ? parseFloat(maxDistanceMiles) : 100;

            try {
                const suggestedPeak = await getSuggestedPeak(
                    userId,
                    userLat,
                    userLng,
                    maxDist
                );

                if (!suggestedPeak) {
                    reply.code(204).send();
                    return;
                }

                reply.code(200).send(suggestedPeak);
            } catch (error) {
                console.error("Error getting suggested peak:", error);
                reply.code(500).send({ message: "Internal server error" });
            }
        }
    );

    done();
};

export default dashboard;

