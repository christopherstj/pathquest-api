import Summit from "../../typeDefs/Summit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";

// Extended summit type with user info for public display
interface PublicSummit extends Summit {
    user_id?: string;
    user_name?: string;
}

export interface PublicSummitsResult {
    summits: PublicSummit[];
    nextCursor: string | null;
    totalCount: number;
}

export interface PublicSummitsFilters {
    cursor?: string; // ISO timestamp for pagination
    limit?: number;
}

/**
 * Get public summits for a peak with cursor-based pagination
 * Returns paginated summits ordered by timestamp DESC (most recent first)
 */
const getPublicSummitsByPeakCursor = async (
    peakId: string,
    filters: PublicSummitsFilters = {}
): Promise<PublicSummitsResult> => {
    const db = await getCloudSqlConnection();
    const { cursor, limit = 20 } = filters;
    
    const params: (string | number)[] = [peakId];
    let paramIndex = 2;
    
    // Build WHERE clause for cursor pagination
    const cursorClause = cursor 
        ? `AND ap.timestamp < $${paramIndex}::timestamptz`
        : "";
    if (cursor) {
        params.push(cursor);
        paramIndex++;
    }
    
    // Get total count (for first page only, to avoid expensive count on every page)
    let totalCount = 0;
    if (!cursor) {
        const countResult = await db.query<{ count: string }>(
            `
            SELECT COUNT(*) as count
            FROM (
                SELECT a.user_id, ap.id, ap.timestamp, ap.peak_id, ap.notes, ap.is_public, ap.temperature, ap.precipitation, ap.weather_code, ap.cloud_cover, ap.wind_speed, ap.wind_direction, ap.humidity, ap.difficulty, ap.experience_rating, a.timezone, ap.condition_tags, ap.custom_condition_tags 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, id, timestamp, peak_id, notes, is_public, temperature, precipitation, weather_code, cloud_cover, wind_speed, wind_direction, humidity, difficulty, experience_rating, timezone, condition_tags, custom_condition_tags 
                FROM user_peak_manual
            ) ap
            LEFT JOIN users u ON u.id = ap.user_id
            WHERE peak_id = $1
            AND ap.is_public = TRUE
            AND u.is_public = TRUE
            `,
            [peakId]
        );
        totalCount = parseInt(countResult.rows[0]?.count || "0", 10);
    }
    
    // Get paginated summits
    const limitParam = `$${paramIndex}`;
    params.push(limit);
    paramIndex++;
    
    const rows = (
        await db.query(
            `
            -- Note: activity_id intentionally excluded to comply with Strava API guidelines
            -- Strava data can only be shown to the activity owner, not other users
            SELECT 
                ap.id, 
                ap.timestamp, 
                ap.notes, 
                ap.is_public, 
                ap.temperature, 
                ap.precipitation, 
                ap.weather_code, 
                ap.cloud_cover, 
                ap.wind_speed, 
                ap.wind_direction, 
                ap.humidity,
                ap.difficulty,
                ap.experience_rating,
                ap.timezone,
                ap.condition_tags,
                ap.custom_condition_tags,
                u.id as user_id,
                u.name as user_name
            FROM (
                SELECT a.user_id, ap.id, ap.timestamp, ap.peak_id, ap.notes, ap.is_public, ap.temperature, ap.precipitation, ap.weather_code, ap.cloud_cover, ap.wind_speed, ap.wind_direction, ap.humidity, ap.difficulty, ap.experience_rating, a.timezone, ap.condition_tags, ap.custom_condition_tags 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, id, timestamp, peak_id, notes, is_public, temperature, precipitation, weather_code, cloud_cover, wind_speed, wind_direction, humidity, difficulty, experience_rating, timezone, condition_tags, custom_condition_tags 
                FROM user_peak_manual
            ) ap
            LEFT JOIN users u ON u.id = ap.user_id
            WHERE peak_id = $1
            AND ap.is_public = TRUE
            AND u.is_public = TRUE
            ${cursorClause}
            ORDER BY ap.timestamp DESC
            LIMIT ${limitParam}::integer
            `,
            params
        )
    ).rows as PublicSummit[];

    const convertedRows = convertPgNumbers(rows);
    
    // Determine next cursor (timestamp of last item if we got a full page)
    const nextCursor = convertedRows.length === limit && convertedRows.length > 0
        ? convertedRows[convertedRows.length - 1].timestamp
        : null;
    
    return {
        summits: convertedRows,
        nextCursor,
        totalCount,
    };
};

export default getPublicSummitsByPeakCursor;




