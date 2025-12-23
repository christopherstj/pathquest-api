import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";
import Peak from "../../typeDefs/Peak";

export interface UserPeakWithSummitCount extends Peak {
    summit_count: number;
    first_summit_date?: string;
    last_summit_date?: string;
}

export type PeakSortBy = "summits" | "elevation" | "recent" | "oldest" | "name";

export interface SearchUserPeaksFilters {
    search?: string;
    state?: string;
    minElevation?: number; // in meters
    maxElevation?: number; // in meters
    hasMultipleSummits?: boolean;
    sortBy?: PeakSortBy;
}

/**
 * Searches user's summited peaks with filtering and sorting
 * Returns peaks grouped with summit counts and first/last summit dates
 */
const searchUserPeaks = async (
    userId: string,
    includePrivate: boolean = false,
    filters: SearchUserPeaksFilters = {},
    page: number = 1,
    pageSize: number = 50
): Promise<{ peaks: UserPeakWithSummitCount[]; totalCount: number }> => {
    const db = await getCloudSqlConnection();
    const offset = (page - 1) * pageSize;

    const { search, state, minElevation, maxElevation, hasMultipleSummits, sortBy = "summits" } = filters;

    const params: (string | boolean | number)[] = [userId, includePrivate];
    let paramIndex = 3;

    // Build WHERE clauses
    const whereClauses: string[] = [];

    if (search) {
        whereClauses.push(`p.name ILIKE $${paramIndex}`);
        params.push(`%${search}%`);
        paramIndex++;
    }

    if (state) {
        whereClauses.push(`p.state = $${paramIndex}`);
        params.push(state);
        paramIndex++;
    }

    if (minElevation !== undefined) {
        whereClauses.push(`p.elevation >= $${paramIndex}`);
        params.push(minElevation);
        paramIndex++;
    }

    if (maxElevation !== undefined) {
        whereClauses.push(`p.elevation < $${paramIndex}`);
        params.push(maxElevation);
        paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? `AND ${whereClauses.join(" AND ")}` : "";

    // Build HAVING clause for multiple summits filter
    const havingClause = hasMultipleSummits ? "HAVING COUNT(ap.id) > 1" : "";

    // Build ORDER BY clause
    let orderByClause: string;
    switch (sortBy) {
        case "elevation":
            orderByClause = "p.elevation DESC NULLS LAST, COUNT(ap.id) DESC";
            break;
        case "recent":
            orderByClause = "MAX(ap.timestamp) DESC, COUNT(ap.id) DESC";
            break;
        case "oldest":
            orderByClause = "MIN(ap.timestamp) ASC, COUNT(ap.id) DESC";
            break;
        case "name":
            orderByClause = "p.name ASC, COUNT(ap.id) DESC";
            break;
        case "summits":
        default:
            orderByClause = "COUNT(ap.id) DESC, MAX(ap.timestamp) DESC";
            break;
    }

    // Query for peaks with summit counts (user + public)
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
            MAX(ap.timestamp) AS last_summit_date,
            (
                SELECT COUNT(DISTINCT pub.id)
                FROM (
                    SELECT ap4.id, ap4.peak_id 
                    FROM activities_peaks ap4
                    LEFT JOIN activities a4 ON a4.id = ap4.activity_id
                    LEFT JOIN users u4 ON u4.id = a4.user_id
                    WHERE ap4.is_public = true 
                    AND u4.is_public = true
                    AND COALESCE(ap4.confirmation_status, 'auto_confirmed') != 'denied'
                    UNION
                    SELECT upm.id, upm.peak_id 
                    FROM user_peak_manual upm
                    LEFT JOIN users u5 ON u5.id = upm.user_id
                    WHERE upm.is_public = true AND u5.is_public = true
                ) pub
                WHERE pub.peak_id = p.id
            ) AS public_summits
        FROM (
            SELECT a.user_id, ap.id, ap.timestamp, ap.peak_id, ap.is_public 
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION
            SELECT user_id, id, timestamp, peak_id, is_public 
            FROM user_peak_manual
        ) ap
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ${whereClause}
        GROUP BY p.id, p.name, p.elevation, p.county, p.state, p.country, p.type, p.location_coords
        ${havingClause}
        ORDER BY ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(pageSize, offset);

    // Build count query with same filters
    const countParams: (string | boolean | number)[] = [userId, includePrivate];
    let countParamIndex = 3;
    const countWhereClauses: string[] = [];

    if (search) {
        countWhereClauses.push(`p.name ILIKE $${countParamIndex}`);
        countParams.push(`%${search}%`);
        countParamIndex++;
    }

    if (state) {
        countWhereClauses.push(`p.state = $${countParamIndex}`);
        countParams.push(state);
        countParamIndex++;
    }

    if (minElevation !== undefined) {
        countWhereClauses.push(`p.elevation >= $${countParamIndex}`);
        countParams.push(minElevation);
        countParamIndex++;
    }

    if (maxElevation !== undefined) {
        countWhereClauses.push(`p.elevation < $${countParamIndex}`);
        countParams.push(maxElevation);
        countParamIndex++;
    }

    const countWhereClause = countWhereClauses.length > 0 ? `AND ${countWhereClauses.join(" AND ")}` : "";

    // For count with HAVING, we need a subquery
    const countQuery = hasMultipleSummits
        ? `
            SELECT COUNT(*) as total FROM (
                SELECT p.id
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
                ${countWhereClause}
                GROUP BY p.id
                HAVING COUNT(ap.id) > 1
            ) subq
        `
        : `
            SELECT COUNT(DISTINCT p.id) as total
            FROM (
                SELECT a.user_id, ap.peak_id, ap.is_public 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, peak_id, is_public 
                FROM user_peak_manual
            ) ap
            LEFT JOIN peaks p ON ap.peak_id = p.id
            WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
            ${countWhereClause}
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
        public_summits: parseInt(row.public_summits) || 0,
        first_summit_date: row.first_summit_date,
        last_summit_date: row.last_summit_date,
    }));

    return {
        peaks: convertPgNumbers(peaks),
        totalCount: parseInt(countResult.rows[0].total) || 0,
    };
};

export default searchUserPeaks;
