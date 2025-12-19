import getCloudSqlConnection from "../getCloudSqlConnection";

/**
 * Gets the list of states where a user has summited peaks
 * Used to populate the state filter dropdown
 */
const getStatesWithSummits = async (
    userId: string,
    includePrivate: boolean = false
): Promise<string[]> => {
    const db = await getCloudSqlConnection();

    const query = `
        SELECT DISTINCT p.state
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
        WHERE ap.user_id = $1 
        AND (ap.is_public = true OR $2)
        AND p.state IS NOT NULL
        AND p.state != ''
        ORDER BY p.state ASC
    `;

    const result = await db.query(query, [userId, includePrivate]);

    return result.rows.map(row => row.state);
};

export default getStatesWithSummits;

