import getCloudSqlConnection from "../getCloudSqlConnection";

export interface ChallengeProgressInfo {
    total: number;
    completed: number;
    lastProgressDate: string | null;
    lastProgressCount: number;
}

/**
 * Gets progress info for a specific challenge and user,
 * including total peaks, completed peaks, last progress date, and count of peaks completed on that date.
 */
const getChallengeProgress = async (
    challengeId: number,
    userId: string
): Promise<ChallengeProgressInfo> => {
    const db = await getCloudSqlConnection();

    const query = `
        WITH user_summits AS (
            SELECT DISTINCT ap.peak_id, DATE(ap.timestamp) as summit_date
            FROM (
                SELECT a.user_id, ap.id, ap.peak_id, ap.timestamp, ap.is_public 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, id, peak_id, timestamp, is_public 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1
        ),
        peak_summits AS (
            SELECT DISTINCT peak_id
            FROM user_summits
        ),
        challenge_peaks AS (
            SELECT pc.peak_id
            FROM peaks_challenges pc
            WHERE pc.challenge_id = $2
        ),
        challenge_summits AS (
            SELECT us.peak_id, us.summit_date
            FROM user_summits us
            INNER JOIN challenge_peaks cp ON us.peak_id = cp.peak_id
        ),
        most_recent_date AS (
            SELECT summit_date
            FROM challenge_summits
            ORDER BY summit_date DESC
            LIMIT 1
        ),
        peaks_on_date AS (
            SELECT COUNT(DISTINCT peak_id) as count
            FROM challenge_summits
            WHERE summit_date = (SELECT summit_date FROM most_recent_date)
        )
        SELECT 
            (SELECT COUNT(*) FROM challenge_peaks) as total,
            (SELECT COUNT(*) FROM peak_summits ps INNER JOIN challenge_peaks cp ON ps.peak_id = cp.peak_id) as completed,
            (SELECT summit_date::text FROM most_recent_date) as last_progress_date,
            COALESCE((SELECT count FROM peaks_on_date), 0) as last_progress_count
    `;

    const result = await db.query(query, [userId, challengeId]);
    const row = result.rows[0];

    return {
        total: parseInt(row?.total) || 0,
        completed: parseInt(row?.completed) || 0,
        lastProgressDate: row?.last_progress_date || null,
        lastProgressCount: parseInt(row?.last_progress_count) || 0,
    };
};

export default getChallengeProgress;

