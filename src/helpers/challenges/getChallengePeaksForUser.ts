import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";

export interface ChallengePeakWithSummit extends Peak {
    is_summited: boolean;
    summit_date: string | null;
}

/**
 * Gets peaks for a challenge with summit status for a specific user.
 * Used for viewing another user's progress on a challenge.
 * Only includes public summit data per Strava API compliance.
 * 
 * @param challengeId - The challenge ID
 * @param userId - The user whose progress we're viewing
 * @returns Array of peaks with is_summited and summit_date fields
 */
const getChallengePeaksForUser = async (
    challengeId: number,
    userId: string
): Promise<ChallengePeakWithSummit[]> => {
    const db = await getCloudSqlConnection();
    
    const query = `
        WITH user_public_summits AS (
            -- Get all public summits for the user with their timestamps
            SELECT DISTINCT ON (ap.peak_id) 
                ap.peak_id, 
                ap.timestamp as summit_date
            FROM (
                SELECT a.user_id, ap.peak_id, ap.timestamp, ap.is_public 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, peak_id, timestamp, is_public 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1 AND ap.is_public = true
            ORDER BY ap.peak_id, ap.timestamp ASC
        )
        SELECT 
            p.id, 
            p.name, 
            p.elevation, 
            p.county, 
            p.state, 
            p.country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
            ups.peak_id IS NOT NULL AS is_summited,
            ups.summit_date::text as summit_date
        FROM peaks_challenges pc
        LEFT JOIN peaks p ON pc.peak_id = p.id
        LEFT JOIN user_public_summits ups ON p.id = ups.peak_id
        WHERE pc.challenge_id = $2
        ORDER BY p.elevation DESC
    `;

    const result = await db.query(query, [userId, challengeId]);
    return convertPgNumbers(result.rows) as ChallengePeakWithSummit[];
};

export default getChallengePeaksForUser;

