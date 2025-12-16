import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";
import Peak from "../../typeDefs/Peak";

export interface UserPeakWithSummitCount extends Peak {
    summit_count: number;
    first_summit_date?: string;
    last_summit_date?: string;
}

/**
 * Searches user's summited peaks by peak name
 * Returns peaks grouped with summit counts and first/last summit dates
 * Based on getPeakSummitsByUser pattern but with search support
 */
const searchUserPeaks = async (
    userId: string,
    includePrivate: boolean = false,
    search?: string,
    page: number = 1,
    pageSize: number = 50
): Promise<{ peaks: UserPeakWithSummitCount[]; totalCount: number }> => {
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

    // Query for peaks with summit counts
    const query = `
        SELECT 
            p.id,
            p.name,
            p.elevation,
            p.county,
            p.state,
            p.country,
            p.type,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] AS location_coords,
            COUNT(ap.id) AS summit_count,
            MIN(ap.timestamp) AS first_summit_date,
            MAX(ap.timestamp) AS last_summit_date
        FROM (
            SELECT a.user_id, ap.id, ap.timestamp, ap.peak_id, ap.is_public 
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            UNION
            SELECT user_id, id, timestamp, peak_id, is_public 
            FROM user_peak_manual
        ) ap
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ${searchClause}
        GROUP BY p.id, p.name, p.elevation, p.county, p.state, p.country, p.type, p.location_coords
        ORDER BY COUNT(ap.id) DESC, MAX(ap.timestamp) DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(pageSize, offset);

    // Count query (count distinct peaks)
    const countParams: (string | boolean)[] = [userId, includePrivate];
    let countSearchClause = "";
    if (search) {
        countSearchClause = `AND p.name ILIKE $3`;
        countParams.push(`%${search}%`);
    }

    const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM (
            SELECT a.user_id, ap.peak_id, ap.is_public 
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            UNION
            SELECT user_id, peak_id, is_public 
            FROM user_peak_manual
        ) ap
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ${countSearchClause}
    `;

    const [peaksResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams),
    ]);

    const peaks: UserPeakWithSummitCount[] = peaksResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        elevation: row.elevation,
        county: row.county,
        state: row.state,
        country: row.country,
        location_coords: row.location_coords,
        summit_count: parseInt(row.summit_count) || 0,
        first_summit_date: row.first_summit_date,
        last_summit_date: row.last_summit_date,
    }));

    return {
        peaks: convertPgNumbers(peaks),
        totalCount: parseInt(countResult.rows[0].total) || 0,
    };
};

export default searchUserPeaks;

