import getCloudSqlConnection from "../getCloudSqlConnection";
import Challenge from "../../typeDefs/Challenge";

/**
 * Returns challenges ordered by a “hybrid popularity” score:
 * 1) Public favorites (from public users)
 * 2) Recent (7-day) community activity on challenge peaks (from public users)
 *
 * NOTE: Popularity counts are used ONLY for ordering and are not returned.
 */
const getPopularChallenges = async (limit: number = 5): Promise<Challenge[]> => {
    const db = await getCloudSqlConnection();

    const rows = (
        await db.query(
            `
            WITH
            challenge_peak_counts AS (
                SELECT pc.challenge_id, COUNT(pc.peak_id)::int AS num_peaks
                FROM peaks_challenges pc
                GROUP BY pc.challenge_id
            ),
            public_favorites AS (
                SELECT ucf.challenge_id, COUNT(*)::int AS favorites_count
                FROM user_challenge_favorite ucf
                INNER JOIN users u ON u.id = ucf.user_id
                WHERE ucf.is_public = TRUE
                  AND u.is_public = TRUE
                GROUP BY ucf.challenge_id
            ),
            recent_summits AS (
                SELECT
                    a.user_id,
                    ap.peak_id
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE ap.is_public = TRUE
                  AND ap.timestamp >= NOW() - INTERVAL '7 days'
                  AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'

                UNION ALL

                SELECT
                    user_id,
                    peak_id
                FROM user_peak_manual
                WHERE is_public = TRUE
                  AND timestamp >= NOW() - INTERVAL '7 days'
            ),
            recent_summits_public_users AS (
                SELECT rs.user_id, rs.peak_id
                FROM recent_summits rs
                INNER JOIN users u ON u.id = rs.user_id
                WHERE u.is_public = TRUE
            ),
            recent_activity AS (
                SELECT
                    pc.challenge_id,
                    COUNT(DISTINCT rs.user_id)::int AS weekly_active_users,
                    COUNT(*)::int AS weekly_summits
                FROM peaks_challenges pc
                INNER JOIN recent_summits_public_users rs ON rs.peak_id = pc.peak_id
                GROUP BY pc.challenge_id
            )
            SELECT
                c.*,
                COALESCE(cpc.num_peaks, 0)::int AS num_peaks
            FROM challenges c
            LEFT JOIN challenge_peak_counts cpc ON cpc.challenge_id = c.id
            LEFT JOIN public_favorites pf ON pf.challenge_id = c.id
            LEFT JOIN recent_activity ra ON ra.challenge_id = c.id
            ORDER BY
                COALESCE(pf.favorites_count, 0) DESC,
                COALESCE(ra.weekly_active_users, 0) DESC,
                COALESCE(ra.weekly_summits, 0) DESC,
                c.id ASC
            LIMIT $1
        `,
            [limit]
        )
    ).rows as Challenge[];

    return rows;
};

export default getPopularChallenges;


