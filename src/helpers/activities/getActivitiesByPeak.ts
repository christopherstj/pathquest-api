import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const getActivityByPeak = async (peakId: string, userId: string) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<(Activity & RowDataPacket)[]>(
        `SELECT DISTINCT a.* FROM (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap LEFT JOIN Activity a ON ap.activityId = a.id WHERE ap.peakId = ? AND a.userId = ?`,
        [peakId, userId]
    );

    await connection.end();

    return rows;
};

export default getActivityByPeak;
