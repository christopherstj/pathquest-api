import { FastifyInstance } from "fastify";
import getCloudSqlConnection from "../helpers/getCloudSqlConnection";

export interface DashboardStats {
    totalPeaks: number;
    totalElevationGained: number; // in meters
    summitsThisMonth: number;
    summitsLastMonth: number;
    primaryChallengeProgress: {
        challengeId: number;
        name: string;
        completed: number;
        total: number;
    } | null;
}

const getDashboardStats = async (userId: string): Promise<DashboardStats> => {
    const db = await getCloudSqlConnection();

    // Get current month start and last month start/end
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Main query for aggregated stats
    const statsQuery = `
        WITH user_summits AS (
            SELECT ap.peak_id, ap.timestamp
            FROM (
                SELECT a.user_id, ap.timestamp, ap.peak_id 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, timestamp, peak_id 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1
        ),
        distinct_peaks AS (
            SELECT DISTINCT us.peak_id, p.elevation
            FROM user_summits us
            LEFT JOIN peaks p ON us.peak_id = p.id
        )
        SELECT 
            COUNT(DISTINCT dp.peak_id) AS total_peaks,
            COALESCE(SUM(dp.elevation), 0) AS total_elevation,
            (SELECT COUNT(*) FROM user_summits WHERE timestamp >= $2) AS summits_this_month,
            (SELECT COUNT(*) FROM user_summits WHERE timestamp >= $3 AND timestamp <= $4) AS summits_last_month
        FROM distinct_peaks dp
    `;

    const statsResult = await db.query(statsQuery, [
        userId,
        currentMonthStart.toISOString(),
        lastMonthStart.toISOString(),
        lastMonthEnd.toISOString(),
    ]);
    const stats = statsResult.rows[0];

    // Get primary challenge (favorite challenge with highest progress percentage, excluding completed)
    const primaryChallengeQuery = `
        SELECT 
            c.id AS challenge_id,
            c.name,
            COUNT(p.id) AS total,
            COUNT(ap2.summitted) AS completed,
            CASE WHEN COUNT(p.id) > 0 
                THEN (COUNT(ap2.summitted)::float / COUNT(p.id)::float) 
                ELSE 0 
            END AS progress_pct
        FROM challenges c
        INNER JOIN user_challenge_favorite ucf ON c.id = ucf.challenge_id
        LEFT JOIN peaks_challenges pc ON pc.challenge_id = c.id
        LEFT JOIN peaks p ON pc.peak_id = p.id
        LEFT JOIN (
            SELECT ap.peak_id, COUNT(ap.peak_id) > 0 AS summitted 
            FROM (
                SELECT a.user_id, ap.peak_id 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, peak_id 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1
            GROUP BY ap.peak_id
        ) ap2 ON p.id = ap2.peak_id
        WHERE ucf.user_id = $1
        GROUP BY c.id, c.name
        HAVING COUNT(ap2.summitted) < COUNT(p.id)
        ORDER BY progress_pct DESC, completed DESC
        LIMIT 1
    `;

    const primaryChallengeResult = await db.query(primaryChallengeQuery, [userId]);
    const primaryChallenge = primaryChallengeResult.rows[0];

    return {
        totalPeaks: parseInt(stats.total_peaks) || 0,
        totalElevationGained: parseFloat(stats.total_elevation) || 0,
        summitsThisMonth: parseInt(stats.summits_this_month) || 0,
        summitsLastMonth: parseInt(stats.summits_last_month) || 0,
        primaryChallengeProgress: primaryChallenge
            ? {
                  challengeId: parseInt(primaryChallenge.challenge_id),
                  name: primaryChallenge.name,
                  completed: parseInt(primaryChallenge.completed) || 0,
                  total: parseInt(primaryChallenge.total) || 0,
              }
            : null,
    };
};

const dashboard = (fastify: FastifyInstance, _: any, done: any) => {
    // Get dashboard stats for authenticated user
    fastify.get(
        "/stats",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const stats = await getDashboardStats(userId);
            reply.code(200).send(stats);
        }
    );

    done();
};

export default dashboard;

