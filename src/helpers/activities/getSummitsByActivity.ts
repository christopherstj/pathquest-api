import { RowDataPacket } from "mysql2";
import db from "../getCloudSqlConnection";

const getSummitsByActivity = async (activityId: string) => {
    const [rows] = await db.query<
        ({ id: string; timestamp: string } & RowDataPacket)[]
    >(
        `SELECT ap.id, ap.\`timestamp\` FROM Activity a LEFT JOIN (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap ON a.id = ap.activityId WHERE a.id = ?`,
        [activityId]
    );

    return rows;
};

export default getSummitsByActivity;
