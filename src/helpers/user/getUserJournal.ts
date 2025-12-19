import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";

export interface JournalEntry {
    id: string;
    timestamp: string;
    notes?: string;
    difficulty?: "easy" | "moderate" | "hard" | "expert";
    experienceRating?: "amazing" | "good" | "tough" | "epic";
    conditionTags?: string[];
    customConditionTags?: string[];
    isPublic?: boolean;
    timezone?: string;
    hasReport: boolean;
    summitNumber: number;
    // Weather data
    temperature?: number;
    weatherCode?: number;
    cloudCover?: number;
    windSpeed?: number;
    // Peak data (inline)
    peak: {
        id: string;
        name: string;
        elevation?: number;
        state?: string;
        country?: string;
    };
    // Activity data (inline, optional - null for manual summits)
    activity?: {
        id: string;
        title: string;
        sport?: string;
        distance?: number;
        gain?: number;
    };
}

export interface JournalResult {
    entries: JournalEntry[];
    nextCursor: string | null;
    totalCount: number;
}

export interface JournalFilters {
    cursor?: string; // ISO timestamp for pagination
    limit?: number;
    search?: string; // Peak name search
    year?: number;
    hasReport?: boolean;
    peakId?: string;
}

/**
 * Get user's journal entries with optimized single query
 * Returns paginated entries with all data inline (no N+1 queries)
 */
const getUserJournal = async (
    userId: string,
    includePrivate: boolean = false,
    filters: JournalFilters = {}
): Promise<JournalResult> => {
    const db = await getCloudSqlConnection();
    
    const { cursor, limit = 20, search, year, hasReport, peakId } = filters;
    
    const params: (string | boolean | number)[] = [userId, includePrivate];
    let paramIndex = 3;
    
    // Build WHERE clauses for filters (use ns.* since we query from numbered_summits ns)
    const filterClauses: string[] = [];
    
    if (cursor) {
        filterClauses.push(`ns.timestamp < $${paramIndex}::timestamptz`);
        params.push(cursor);
        paramIndex++;
    }
    
    if (search) {
        filterClauses.push(`p.name ILIKE $${paramIndex}`);
        params.push(`%${search}%`);
        paramIndex++;
    }
    
    if (year) {
        filterClauses.push(`EXTRACT(YEAR FROM ns.timestamp) = $${paramIndex}`);
        params.push(year);
        paramIndex++;
    }
    
    if (peakId) {
        filterClauses.push(`ns.peak_id = $${paramIndex}`);
        params.push(peakId);
        paramIndex++;
    }
    
    // hasReport filter - handled after CTE since it depends on computed column
    let hasReportFilter = "";
    if (hasReport === true) {
        hasReportFilter = "AND has_report = true";
    } else if (hasReport === false) {
        hasReportFilter = "AND has_report = false";
    }
    
    const filterClause = filterClauses.length > 0 
        ? "AND " + filterClauses.join(" AND ") 
        : "";
    
    // Main query with all data inline
    const query = `
        WITH all_summits AS (
            -- Strava activity summits
            SELECT 
                ap.id,
                ap.timestamp,
                ap.peak_id,
                ap.notes,
                ap.is_public,
                ap.difficulty,
                ap.experience_rating,
                ap.condition_tags,
                ap.custom_condition_tags,
                ap.temperature,
                ap.weather_code,
                ap.cloud_cover,
                ap.wind_speed,
                a.timezone,
                a.id AS activity_id,
                a.title AS activity_title,
                a.sport AS activity_sport,
                a.distance AS activity_distance,
                a.gain AS activity_gain,
                'strava' AS source
            FROM activities_peaks ap
            INNER JOIN activities a ON a.id = ap.activity_id
            WHERE a.user_id = $1
              AND (ap.is_public = true OR $2)
              AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            
            UNION ALL
            
            -- Manual summits
            SELECT 
                upm.id,
                upm.timestamp,
                upm.peak_id,
                upm.notes,
                upm.is_public,
                upm.difficulty,
                upm.experience_rating,
                upm.condition_tags,
                upm.custom_condition_tags,
                upm.temperature,
                upm.weather_code,
                upm.cloud_cover,
                upm.wind_speed,
                upm.timezone,
                upm.activity_id,
                NULL AS activity_title,
                NULL AS activity_sport,
                NULL AS activity_distance,
                NULL AS activity_gain,
                'manual' AS source
            FROM user_peak_manual upm
            WHERE upm.user_id = $1
              AND (upm.is_public = true OR $2)
        ),
        numbered_summits AS (
            SELECT 
                *,
                ROW_NUMBER() OVER (ORDER BY timestamp ASC) AS summit_number,
                (notes IS NOT NULL AND TRIM(notes) != '' 
                 OR difficulty IS NOT NULL 
                 OR experience_rating IS NOT NULL) AS has_report
            FROM all_summits
        ),
        filtered_summits AS (
            SELECT ns.*
            FROM numbered_summits ns
            LEFT JOIN peaks p ON ns.peak_id = p.id
            WHERE 1=1 ${filterClause} ${hasReportFilter}
        )
        SELECT 
            fs.id,
            fs.timestamp::text AS timestamp,
            fs.peak_id,
            fs.notes,
            fs.is_public,
            fs.difficulty,
            fs.experience_rating,
            fs.condition_tags,
            fs.custom_condition_tags,
            fs.temperature,
            fs.weather_code,
            fs.cloud_cover,
            fs.wind_speed,
            fs.timezone,
            fs.activity_id,
            fs.activity_title,
            fs.activity_sport,
            fs.activity_distance,
            fs.activity_gain,
            fs.summit_number,
            fs.has_report,
            p.name AS peak_name,
            p.elevation AS peak_elevation,
            p.state AS peak_state,
            p.country AS peak_country
        FROM filtered_summits fs
        LEFT JOIN peaks p ON fs.peak_id = p.id
        ORDER BY fs.timestamp DESC
        LIMIT $${paramIndex}
    `;
    
    params.push(limit + 1); // Fetch one extra to determine if there's a next page
    
    // Count query (for total count without pagination)
    const countParams: (string | boolean | number)[] = [userId, includePrivate];
    let countParamIndex = 3;
    const countFilterClauses: string[] = [];
    
    if (search) {
        countFilterClauses.push(`p.name ILIKE $${countParamIndex}`);
        countParams.push(`%${search}%`);
        countParamIndex++;
    }
    
    if (year) {
        countFilterClauses.push(`EXTRACT(YEAR FROM with_report.timestamp) = $${countParamIndex}`);
        countParams.push(year);
        countParamIndex++;
    }
    
    if (peakId) {
        countFilterClauses.push(`with_report.peak_id = $${countParamIndex}`);
        countParams.push(peakId);
        countParamIndex++;
    }
    
    const countFilterClause = countFilterClauses.length > 0 
        ? "AND " + countFilterClauses.join(" AND ") 
        : "";
    
    const countQuery = `
        WITH all_summits AS (
            SELECT ap.id, ap.timestamp, ap.peak_id, ap.notes, ap.difficulty, ap.experience_rating
            FROM activities_peaks ap
            INNER JOIN activities a ON a.id = ap.activity_id
            WHERE a.user_id = $1
              AND (ap.is_public = true OR $2)
              AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION ALL
            SELECT id, timestamp, peak_id, notes, difficulty, experience_rating
            FROM user_peak_manual
            WHERE user_id = $1
              AND (is_public = true OR $2)
        ),
        with_report AS (
            SELECT 
                *,
                (notes IS NOT NULL AND TRIM(notes) != '' 
                 OR difficulty IS NOT NULL 
                 OR experience_rating IS NOT NULL) AS has_report
            FROM all_summits
        )
        SELECT COUNT(*) AS total
        FROM with_report
        LEFT JOIN peaks p ON with_report.peak_id = p.id
        WHERE 1=1 ${countFilterClause} ${hasReportFilter}
    `;
    
    const [entriesResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams),
    ]);
    
    const rows = entriesResult.rows;
    const hasMore = rows.length > limit;
    const entries = rows.slice(0, limit);
    
    const journalEntries: JournalEntry[] = entries.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        notes: row.notes,
        difficulty: row.difficulty,
        experienceRating: row.experience_rating,
        conditionTags: row.condition_tags,
        customConditionTags: row.custom_condition_tags,
        isPublic: row.is_public,
        timezone: row.timezone,
        hasReport: row.has_report,
        summitNumber: parseInt(row.summit_number) || 0,
        temperature: row.temperature,
        weatherCode: row.weather_code,
        cloudCover: row.cloud_cover,
        windSpeed: row.wind_speed,
        peak: {
            id: row.peak_id,
            name: row.peak_name,
            elevation: row.peak_elevation,
            state: row.peak_state,
            country: row.peak_country,
        },
        activity: row.activity_id ? {
            id: row.activity_id,
            title: row.activity_title || "Activity",
            sport: row.activity_sport,
            distance: row.activity_distance,
            gain: row.activity_gain,
        } : undefined,
    }));
    
    return {
        entries: convertPgNumbers(journalEntries),
        nextCursor: hasMore && entries.length > 0 
            ? entries[entries.length - 1].timestamp 
            : null,
        totalCount: parseInt(countResult.rows[0].total) || 0,
    };
};

export default getUserJournal;

