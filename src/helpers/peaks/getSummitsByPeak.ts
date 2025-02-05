import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByPeak = async (peakId: string, userId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<
        ({
            id: string;
            timestamp: string;
            activityId: string;
        } & RowDataPacket)[]
    >(
        `
            SELECT ap.id, ap.\`timestamp\`, ap.activityId, ap.notes
            FROM (
                SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
                LEFT JOIN Activity a ON a.id = ap.activityId
                UNION
                SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
            ) ap
            WHERE peakId = ?
            AND ap.userId = ?
        `,
        [peakId, userId]
    );

    connection.release();

    return rows;
};

export default getSummitsByPeak;
