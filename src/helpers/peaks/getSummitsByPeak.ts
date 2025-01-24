import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByPeak = async (peakId: string, userId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<
        ({
            timestamp: number;
            activityId: string;
        } & RowDataPacket)[]
    >(
        `
            SELECT \`timestamp\`, activityId
            FROM (
                SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
                UNION
                SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
            ) ap
            LEFT JOIN Activity a ON ap.activityId = a.id
            WHERE peakId = ?
            AND a.userId = ?
        `,
        [peakId, userId]
    );

    connection.release();

    return rows;
};

export default getSummitsByPeak;
