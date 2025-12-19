import getCloudSqlConnection from "../getCloudSqlConnection";

export interface ChallengeActivity {
    /** Number of unique users who summited challenge peaks this week */
    weeklyActiveUsers: number;
    /** Number of summits on challenge peaks this week */
    weeklySummits: number;
    /** Recent challenge completions (public only) */
    recentCompletions: {
        userId: string;
        userName: string | null;
        completedAt: string;
    }[];
}

/**
 * Gets community activity for a challenge - how many people are actively
 * working on this challenge.
 */
const getChallengeActivity = async (
    challengeId: number
): Promise<ChallengeActivity> => {
    const db = await getCloudSqlConnection();

    // Get weekly activity stats
    const weeklyQuery = `
        WITH challenge_peaks AS (
            SELECT peak_id FROM peaks_challenges WHERE challenge_id = $1
        ),
        recent_summits AS (
            SELECT 
                a.user_id,
                ap.peak_id,
                ap.timestamp
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            INNER JOIN challenge_peaks cp ON ap.peak_id = cp.peak_id
            WHERE ap.is_public = true
            AND ap.timestamp >= NOW() - INTERVAL '7 days'
            AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION
            SELECT 
                user_id,
                peak_id,
                timestamp
            FROM user_peak_manual
            WHERE peak_id IN (SELECT peak_id FROM challenge_peaks)
            AND is_public = true
            AND timestamp >= NOW() - INTERVAL '7 days'
        )
        SELECT 
            COUNT(DISTINCT user_id) AS weekly_users,
            COUNT(*) AS weekly_summits
        FROM recent_summits
    `;

    const weeklyResult = await db.query(weeklyQuery, [challengeId]);
    const weeklyStats = weeklyResult.rows[0] || { weekly_users: 0, weekly_summits: 0 };

    // Get recent challenge completions (users who completed all peaks)
    const completionsQuery = `
        WITH challenge_peaks AS (
            SELECT peak_id FROM peaks_challenges WHERE challenge_id = $1
        ),
        total_peaks AS (
            SELECT COUNT(*) as total FROM challenge_peaks
        ),
        user_summit_counts AS (
            SELECT 
                a.user_id,
                COUNT(DISTINCT ap.peak_id) as peak_count,
                MAX(ap.timestamp) as last_summit
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            INNER JOIN challenge_peaks cp ON ap.peak_id = cp.peak_id
            WHERE ap.is_public = true
            AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            GROUP BY a.user_id
            UNION ALL
            SELECT 
                user_id,
                COUNT(DISTINCT peak_id) as peak_count,
                MAX(timestamp) as last_summit
            FROM user_peak_manual
            WHERE peak_id IN (SELECT peak_id FROM challenge_peaks)
            AND is_public = true
            GROUP BY user_id
        ),
        completed_users AS (
            SELECT 
                usc.user_id,
                MAX(usc.last_summit) as completed_at
            FROM user_summit_counts usc, total_peaks tp
            GROUP BY usc.user_id
            HAVING SUM(usc.peak_count) >= (SELECT total FROM total_peaks)
        )
        SELECT 
            cu.user_id,
            u.name as user_name,
            cu.completed_at
        FROM completed_users cu
        LEFT JOIN users u ON cu.user_id = u.id
        WHERE cu.completed_at >= NOW() - INTERVAL '30 days'
        ORDER BY cu.completed_at DESC
        LIMIT 5
    `;

    const completionsResult = await db.query(completionsQuery, [challengeId]);

    return {
        weeklyActiveUsers: parseInt(weeklyStats.weekly_users) || 0,
        weeklySummits: parseInt(weeklyStats.weekly_summits) || 0,
        recentCompletions: completionsResult.rows.map(row => ({
            userId: row.user_id,
            userName: row.user_name,
            completedAt: row.completed_at?.toISOString() || new Date().toISOString(),
        })),
    };
};

export default getChallengeActivity;

