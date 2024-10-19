import { RowDataPacket } from "mysql2";
import ChallengeProgress from "../../typeDefs/ChallengeProgress";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUncompletedChallenges = async (
    userId: string
): Promise<ChallengeProgress[]> => {
    const connection = await getCloudSqlConnection();

    console.log("userId", userId);

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
                SELECT DISTINCT ap.peakId peakId FROM ActivityPeak ap
                LEFT JOIN Activity a ON ap.activityId = a.id
                WHERE a.userId = ?
            ) ap2 ON p.Id = ap2.peakId
            WHERE c.id <> 0 
            GROUP BY c.id 
            HAVING completed < total
            ORDER BY c.id;
        `,
        [userId]
    );

    return rows;
};

export default getUncompletedChallenges;
