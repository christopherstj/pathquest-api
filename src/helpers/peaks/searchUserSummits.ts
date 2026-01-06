import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";

export interface SummitWithPeak {
    id: string;
    timestamp: string;
    activity_id: string;
    notes?: string;
    temperature?: number;
    precipitation?: number;
    weather_code?: number;
    cloud_cover?: number;
    humidity?: number;
    wind_speed?: number;
    wind_direction?: number;
    is_public?: boolean;
    timezone?: string;
    difficulty?: "easy" | "moderate" | "hard" | "expert";
    experience_rating?: "amazing" | "good" | "tough" | "epic";
    // Nested peak data
    peak: {
        id: string;
        name: string;
        elevation?: number;
        state?: string;
        country?: string;
        location_coords?: [number, number];
    };
}

/**
 * Searches user's summits by peak name and/or state
 * Returns individual summit entries with peak data nested
 */
const searchUserSummits = async (
    userId: string,
    includePrivate: boolean = false,
    search?: string,
    state?: string,
    page: number = 1,
    pageSize: number = 50
): Promise<{ summits: SummitWithPeak[]; totalCount: number }> => {
    const db = await getCloudSqlConnection();
    const offset = (page - 1) * pageSize;

    const params: (string | boolean | number)[] = [userId, includePrivate];
    let paramIndex = 3;

    let searchClause = "";
    if (search) {
        searchClause = `AND p.name ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    let stateClause = "";
    if (state) {
        stateClause = `AND p.state = $${paramIndex}`;
        params.push(state);
        paramIndex++;
    }

    // Query for summits with peak data
    const query = `
        SELECT 
            ap.id,
            ap.timestamp,
            ap.activity_id,
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
            ap.condition_tags,
            ap.custom_condition_tags,
            ap.timezone,
            p.id AS peak_id,
            p.name AS peak_name,
            p.elevation AS peak_elevation,
            p.state AS peak_state,
            p.country AS peak_country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] AS peak_location_coords
        FROM (
            SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public, 
                   ap.temperature, ap.precipitation, ap.weather_code, ap.cloud_cover, ap.wind_speed, 
                   ap.wind_direction, ap.humidity, ap.difficulty, ap.experience_rating, ap.condition_tags, ap.custom_condition_tags, a.timezone 
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION
            SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public, 
                   temperature, precipitation, weather_code, cloud_cover, wind_speed, 
                   wind_direction, humidity, difficulty, experience_rating, condition_tags, custom_condition_tags, timezone 
            FROM user_peak_manual
        ) ap
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ${searchClause}
        ${stateClause}
        ORDER BY ap.timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(pageSize, offset);

    // Count query
    const countParams: (string | boolean)[] = [userId, includePrivate];
    let countParamIndex = 3;
    let countSearchClause = "";
    let countStateClause = "";
    
    if (search) {
        countSearchClause = `AND p.name ILIKE $${countParamIndex}`;
        countParams.push(`%${search}%`);
        countParamIndex++;
    }
    
    if (state) {
        countStateClause = `AND p.state = $${countParamIndex}`;
        countParams.push(state);
        countParamIndex++;
    }

    const countQuery = `
        SELECT COUNT(*) as total
        FROM (
            SELECT a.user_id, ap.id, ap.peak_id, ap.is_public 
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION
            SELECT user_id, id, peak_id, is_public 
            FROM user_peak_manual
        ) ap
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ${countSearchClause}
        ${countStateClause}
    `;

    const [summitsResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams),
    ]);

    const summits: SummitWithPeak[] = summitsResult.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        activity_id: row.activity_id,
        notes: row.notes,
        is_public: row.is_public,
        temperature: row.temperature,
        precipitation: row.precipitation,
        weather_code: row.weather_code,
        cloud_cover: row.cloud_cover,
        humidity: row.humidity,
        wind_speed: row.wind_speed,
        wind_direction: row.wind_direction,
        timezone: row.timezone,
        difficulty: row.difficulty,
        experience_rating: row.experience_rating,
        condition_tags: row.condition_tags,
        custom_condition_tags: row.custom_condition_tags,
        peak: {
            id: row.peak_id,
            name: row.peak_name,
            elevation: row.peak_elevation,
            state: row.peak_state,
            country: row.peak_country,
            location_coords: row.peak_location_coords,
        },
    }));

    return {
        summits: convertPgNumbers(summits),
        totalCount: parseInt(countResult.rows[0].total) || 0,
    };
};

export default searchUserSummits;

