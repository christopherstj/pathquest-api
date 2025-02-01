import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const getActivityByPeak = async (
    peakId: string,
    userId: string,
    justCoords: boolean = false
) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<(Activity & RowDataPacket)[]>(
        `SELECT DISTINCT a.id, a.\`name\`, a.userId, a.startLat, a.startLong, a.distance, a.coords, a.startTime, a.sport, a.timezone, a.gain${
            !justCoords ? ", a.vertProfile, a.distanceStream, a.timeStream" : ""
        } FROM (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap LEFT JOIN Activity a ON ap.activityId = a.id WHERE ap.peakId = ? AND a.userId = ?`,
        [peakId, userId]
    );

    connection.release();

    return rows;
};

export default getActivityByPeak;
