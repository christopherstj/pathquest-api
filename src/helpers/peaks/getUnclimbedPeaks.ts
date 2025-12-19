import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUnclimbedPeaks = async (
    userId: string,
    bounds?: [[number, number], [number, number]],
    search?: string,
    showSummittedPeaks?: boolean
) => {
    const db = await getCloudSqlConnection();

    if (!bounds && !search) {
        return [];
    }

    let paramIndex = 2; // Start at 2 since $1 is userId
    const getWhereClause = () => {
        if (!showSummittedPeaks && bounds && search) {
            const clause = `WHERE ap2.id IS NULL AND p.name ILIKE $${paramIndex} AND p.lat BETWEEN $${
                paramIndex + 1
            } AND $${paramIndex + 2} AND p.long BETWEEN $${
                paramIndex + 3
            } AND $${paramIndex + 4}`;
            paramIndex += 5;
            return clause;
        } else if (!showSummittedPeaks && bounds) {
            const clause = `WHERE ap2.id IS NULL AND p.lat BETWEEN $${paramIndex} AND $${
                paramIndex + 1
            } AND p.long BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}`;
            paramIndex += 4;
            return clause;
        } else if (!showSummittedPeaks && search) {
            const clause = `WHERE ap2.id IS NULL AND p.name ILIKE $${paramIndex}`;
            paramIndex += 1;
            return clause;
        } else if (bounds && search) {
            const clause = `WHERE p.name ILIKE $${paramIndex} AND p.lat BETWEEN $${
                paramIndex + 1
            } AND $${paramIndex + 2} AND p.long BETWEEN $${
                paramIndex + 3
            } AND $${paramIndex + 4}`;
            paramIndex += 5;
            return clause;
        } else if (bounds) {
            const clause = `WHERE p.lat BETWEEN $${paramIndex} AND $${
                paramIndex + 1
            } AND p.long BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}`;
            paramIndex += 4;
            return clause;
        } else if (search) {
            const clause = `WHERE p.name ILIKE $${paramIndex}`;
            paramIndex += 1;
            return clause;
        } else {
            return "";
        }
    };

    const query = `
            SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
            upf.user_id IS NOT NULL AS is_favorited${
                showSummittedPeaks ? ", COUNT(ap2.id) AS summits" : ""
            }
            FROM peaks p 
            LEFT JOIN (
                SELECT ap.id, ap.peak_id FROM (
                    SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public 
                    FROM activities_peaks ap
                    LEFT JOIN activities a ON a.id = ap.activity_id
                    WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                    UNION
                    SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public 
                    FROM user_peak_manual
                ) ap
                WHERE ap.user_id = $1
            ) ap2 ON p.id = ap2.peak_id
            LEFT JOIN user_peak_favorite upf
            ON p.id = upf.peak_id
            ${getWhereClause()}
            GROUP BY p.name, p.id, p.location_coords, upf.user_id, p.elevation, p.county, p.state, p.country
            ORDER BY p.elevation DESC;
        `;

    const rows = (
        await db.query(query, [
            userId,
            ...(search ? [`%${search}%`] : []),
            ...(bounds
                ? [
                      Math.min(bounds[0][0], bounds[1][0]),
                      Math.max(bounds[0][0], bounds[1][0]),
                      Math.min(bounds[0][1], bounds[1][1]),
                      Math.max(bounds[0][1], bounds[1][1]),
                  ]
                : []),
        ])
    ).rows as Peak[];

    return rows;
};

export default getUnclimbedPeaks;
