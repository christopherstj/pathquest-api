import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import AscentDetail from "../../typeDefs/AscentDetail";

const getAscentDetails = async (ascentId: string, userId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<(AscentDetail & RowDataPacket)[]>(
        `SELECT * FROM (
            SELECT a.timezone, a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic = 1 isPublic FROM ActivityPeak ap
            LEFT JOIN Activity a ON ap.activityId = a.id
            UNION
            SELECT timezone, userId, id, timestamp, activityId, peakId, notes, isPublic = 1 isPublic FROM UserPeakManual
        ) ap WHERE ap.id = ? AND ap.userId = ? LIMIT 1`,
        [ascentId, userId]
    );

    connection.release();

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
};

export default getAscentDetails;
