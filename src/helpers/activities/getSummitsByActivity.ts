import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByActivity = async (activityId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<
        ({ id: string; timestamp: string } & RowDataPacket)[]
    >(
        `SELECT ap.id, ap.\`timestamp\` FROM Activity a LEFT JOIN (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap ON a.id = ap.activityId WHERE a.id = ?`,
        [activityId]
    );

    connection.release();

    return rows;
};

export default getSummitsByActivity;
