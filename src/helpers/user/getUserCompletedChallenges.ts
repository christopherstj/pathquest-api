import ChallengeProgress from "../../typeDefs/ChallengeProgress";
import getCloudSqlConnection from "../getCloudSqlConnection";

/**
 * Gets ALL challenges that the user has completed (100% of peaks summited),
 * regardless of whether they have "accepted" (favorited) the challenge.
 * 
 * This is useful for showing users their hidden achievements - challenges
 * they may have completed without even knowing!
 * 
 * @param userId - The user ID to get challenges for
 * @param includePrivate - Whether to include private summits in progress calculation
 */
const getUserCompletedChallenges = async (
    userId: string,
    includePrivate: boolean = false
): Promise<ChallengeProgress[]> => {
    const db = await getCloudSqlConnection();

    const query = `
        WITH user_summit_peaks AS (
            SELECT DISTINCT ap.peak_id
            FROM (
                SELECT a.user_id, ap.peak_id, ap.is_public 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, peak_id, is_public 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ),
        challenge_progress AS (
            SELECT 
                c.id,
                c.name,
                c.region,
                c.description,
                ST_Y(c.location_coords::geometry) as center_lat,
                ST_X(c.location_coords::geometry) as center_long,
                COUNT(DISTINCT pc.peak_id) AS total,
                COUNT(DISTINCT usp.peak_id) AS completed,
                MAX(CASE WHEN ucf.challenge_id IS NOT NULL THEN 1 ELSE 0 END) = 1 AS is_favorited
            FROM challenges c
            LEFT JOIN peaks_challenges pc ON c.id = pc.challenge_id
            LEFT JOIN user_summit_peaks usp ON pc.peak_id = usp.peak_id
            LEFT JOIN user_challenge_favorite ucf ON c.id = ucf.challenge_id AND ucf.user_id = $1
            GROUP BY c.id
        )
        SELECT 
            id,
            name,
            region,
            description,
            center_lat,
            center_long,
            total,
            completed,
            is_favorited,
            true AS is_completed
        FROM challenge_progress
        WHERE 
            total > 0 
            AND completed >= total
        ORDER BY 
            name ASC
    `;

    const result = await db.query(query, [userId, includePrivate]);

    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        region: row.region,
        description: row.description,
        location_coords: row.center_lat && row.center_long 
            ? [parseFloat(row.center_long), parseFloat(row.center_lat)] as [number, number]
            : undefined,
        num_peaks: parseInt(row.total),
        total: parseInt(row.total),
        completed: parseInt(row.completed),
        is_completed: true,
        is_favorited: row.is_favorited,
    }));
};

export default getUserCompletedChallenges;

