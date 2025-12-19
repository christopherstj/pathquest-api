import getCloudSqlConnection from "../getCloudSqlConnection";

export interface NextPeakSuggestion {
    closestPeak: {
        id: string;
        name: string;
        elevation: number;
        latitude: number;
        longitude: number;
        distance: number; // in kilometers
    } | null;
    easiestPeak: {
        id: string;
        name: string;
        elevation: number;
        latitude: number;
        longitude: number;
    } | null;
    totalRemaining: number;
}

/**
 * Gets the next peak suggestion for a challenge - the closest unclimbed peak
 * and the easiest (lowest elevation) unclimbed peak.
 * 
 * @param challengeId The challenge to get suggestions for
 * @param userId The user to check progress for
 * @param userLat User's current latitude (optional)
 * @param userLng User's current longitude (optional)
 * @returns Next peak suggestions with distance and difficulty info
 */
const getNextPeakSuggestion = async (
    challengeId: number,
    userId: string,
    userLat?: number,
    userLng?: number
): Promise<NextPeakSuggestion> => {
    const db = await getCloudSqlConnection();

    // Default location to center of contiguous US if not provided
    const lat = userLat ?? 39.8283;
    const lng = userLng ?? -98.5795;

    const query = `
        WITH user_summits AS (
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
        challenge_peaks AS (
            SELECT pc.peak_id
            FROM peaks_challenges pc
            WHERE pc.challenge_id = $2
        ),
        unclimbed_peaks AS (
            SELECT 
                p.id,
                p.name,
                p.elevation,
                p.latitude,
                p.longitude,
                -- Haversine distance formula (result in km)
                2 * 6371 * ASIN(SQRT(
                    POWER(SIN(RADIANS(p.latitude - $3) / 2), 2) +
                    COS(RADIANS($3)) * COS(RADIANS(p.latitude)) *
                    POWER(SIN(RADIANS(p.longitude - $4) / 2), 2)
                )) AS distance_km
            FROM peaks p
            INNER JOIN challenge_peaks cp ON p.id = cp.peak_id
            LEFT JOIN user_summits us ON p.id = us.peak_id
            WHERE us.peak_id IS NULL
            AND p.latitude IS NOT NULL
            AND p.longitude IS NOT NULL
        ),
        closest AS (
            SELECT id, name, elevation, latitude, longitude, distance_km
            FROM unclimbed_peaks
            ORDER BY distance_km ASC
            LIMIT 1
        ),
        easiest AS (
            SELECT id, name, elevation, latitude, longitude
            FROM unclimbed_peaks
            ORDER BY elevation ASC
            LIMIT 1
        )
        SELECT 
            (SELECT COUNT(*) FROM unclimbed_peaks) AS total_remaining,
            (SELECT json_build_object(
                'id', id::text,
                'name', name,
                'elevation', elevation,
                'latitude', latitude,
                'longitude', longitude,
                'distance', distance_km
            ) FROM closest) AS closest_peak,
            (SELECT json_build_object(
                'id', id::text,
                'name', name,
                'elevation', elevation,
                'latitude', latitude,
                'longitude', longitude
            ) FROM easiest) AS easiest_peak
    `;

    const result = await db.query(query, [userId, challengeId, lat, lng]);
    const row = result.rows[0];

    return {
        closestPeak: row?.closest_peak || null,
        easiestPeak: row?.easiest_peak || null,
        totalRemaining: parseInt(row?.total_remaining) || 0,
    };
};

export default getNextPeakSuggestion;

