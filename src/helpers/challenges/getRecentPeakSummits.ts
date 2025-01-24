import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getRecentPeakSummits = async (userId: string, peakId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [ascents] = await connection.query<
        ({
            timestamp: string;
            activityId: string;
            timezone?: string;
        } & RowDataPacket)[]
    >(
        `
        SELECT ap.\`timestamp\`, ap.activityId, a.\`timezone\`
        FROM (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap
        LEFT JOIN Activity a ON ap.activityId = a.id
        WHERE peakId = ?
        AND a.userId = ?
        ORDER BY ap.\`timestamp\` DESC
        LIMIT 3
    `,
        [peakId, userId]
    );

    connection.release();

    return ascents;
};

export default getRecentPeakSummits;
