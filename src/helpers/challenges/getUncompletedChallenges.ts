import { RowDataPacket } from "mysql2";
import ChallengeProgress from "../../typeDefs/ChallengeProgress";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUncompletedChallenges = async (
    userId: string
): Promise<ChallengeProgress[]> => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<
        (ChallengeProgress & RowDataPacket)[]
    >(
        `
            SELECT 
            c.*, 
            COUNT(pc.peakId) total,
            COUNT(ap2.peakId) completed
            FROM Challenge c 
            LEFT JOIN PeakChallenge pc 
            ON c.id = pc.challengeId 
            LEFT JOIN Peak p
            ON pc.peakId = p.Id
            LEFT JOIN (
                SELECT DISTINCT ap.peakId peakId FROM (
                    SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
                    LEFT JOIN Activity a ON a.id = ap.activityId
                    UNION
                    SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
                ) ap
                WHERE ap.userId = ?
            ) ap2 ON p.Id = ap2.peakId
            GROUP BY c.id 
            HAVING total > 0 AND completed < total
            ORDER BY c.id;
        `,
        [userId]
    );

    connection.release();

    return rows;
};

export default getUncompletedChallenges;
