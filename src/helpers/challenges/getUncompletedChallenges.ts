import ChallengeProgress from "../../typeDefs/ChallengeProgress";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUncompletedChallenges = async (
    userId: string
): Promise<ChallengeProgress[]> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `
            SELECT 
            c.*, 
            COUNT(pc.peak_id) AS total,
            COUNT(ap2.peak_id) AS completed
            FROM challenges c 
            LEFT JOIN peak_challenge pc 
            ON c.id = pc.challenge_id 
            LEFT JOIN peaks p
            ON pc.peak_id = p.id
            LEFT JOIN (
                SELECT DISTINCT ap.peak_id FROM (
                    SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public FROM activities_peaks ap
                    LEFT JOIN activities a ON a.id = ap.activity_id
                    UNION
                    SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
                ) ap
                WHERE ap.user_id = $1
            ) ap2 ON p.id = ap2.peak_id
            GROUP BY c.id 
            HAVING COUNT(pc.peak_id) > 0 AND COUNT(ap2.peak_id) < COUNT(pc.peak_id)
            ORDER BY c.id
        `,
            [userId]
        )
    ).rows as ChallengeProgress[];

    return rows;
};

export default getUncompletedChallenges;
