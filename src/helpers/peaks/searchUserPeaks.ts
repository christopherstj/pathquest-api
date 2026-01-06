import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";
import Peak from "../../typeDefs/Peak";

/**
 * Public land designation priority hierarchy.
 * Lower number = higher priority (more prestigious/specific designation).
 */
const DESIGNATION_PRIORITY: Record<string, number> = {
    'NP': 1,    // National Park (highest)
    'NM': 2,    // National Monument
    'WILD': 3,  // Wilderness Area
    'WSA': 4,   // Wilderness Study Area
    'NRA': 5,   // National Recreation Area
    'NCA': 6,   // National Conservation Area
    'NWR': 7,   // National Wildlife Refuge
    'NF': 8,    // National Forest
    'NG': 9,    // National Grassland
    'SP': 10,   // State Park
    'SW': 11,   // State Wilderness
    'SRA': 12,  // State Recreation Area
    'SF': 13,   // State Forest
};

const DESIGNATION_NAMES: Record<string, string> = {
    'NP': 'National Park',
    'NM': 'National Monument',
    'WILD': 'Wilderness Area',
    'WSA': 'Wilderness Study Area',
    'NRA': 'National Recreation Area',
    'NCA': 'National Conservation Area',
    'NWR': 'National Wildlife Refuge',
    'NF': 'National Forest',
    'NG': 'National Grassland',
    'SP': 'State Park',
    'SW': 'State Wilderness',
    'SRA': 'State Recreation Area',
    'SF': 'State Forest',
};

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

    // Query for peaks with summit counts (user + public) and public lands
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
            ) AS public_summits,
            pl_agg.public_land_name,
            pl_agg.public_land_type,
            pl_agg.public_land_manager
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
        LEFT JOIN LATERAL (
            SELECT pl.unit_nm AS public_land_name, pl.des_tp AS public_land_type, pl.mang_name AS public_land_manager
            FROM peaks_public_lands ppl
            JOIN public_lands pl ON ppl.public_land_id = pl.objectid
            WHERE ppl.peak_id = p.id
            ORDER BY (CASE pl.des_tp
                WHEN 'NP' THEN 1
                WHEN 'NM' THEN 2
                WHEN 'WILD' THEN 3
                WHEN 'WSA' THEN 4
                WHEN 'NRA' THEN 5
                WHEN 'NCA' THEN 6
                WHEN 'NWR' THEN 7
                WHEN 'NF' THEN 8
                WHEN 'NG' THEN 9
                WHEN 'SP' THEN 10
                WHEN 'SW' THEN 11
                WHEN 'SRA' THEN 12
                WHEN 'SF' THEN 13
                ELSE 999
            END)
            LIMIT 1
        ) pl_agg ON true
        WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ${whereClause}
        GROUP BY p.id, p.name, p.elevation, p.county, p.state, p.country, p.type, p.location_coords, pl_agg.public_land_name, pl_agg.public_land_type, pl_agg.public_land_manager
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
        publicLand: row.public_land_name ? {
            name: row.public_land_name,
            type: row.public_land_type || 'Unknown',
            typeName: DESIGNATION_NAMES[row.public_land_type] || row.public_land_type || 'Public Land',
            manager: row.public_land_manager || 'Unknown',
        } : null,
    }));

    return {
        peaks: convertPgNumbers(peaks),
        totalCount: parseInt(countResult.rows[0].total) || 0,
    };
};

export default searchUserPeaks;
