import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeaksByActivity = async (activityId: string): Promise<Peak[]> => {
    const [rows] = await db.query<(Peak & RowDataPacket)[]>(
        `SELECT DISTINCT p.*
        FROM Activity a 
        LEFT JOIN (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            WHERE activityId = ?
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
            WHERE activityId = ?
        ) ap ON a.id = ap.activityId
        LEFT JOIN Peak p ON ap.peakId = p.Id
        WHERE a.id = ?`,
        [activityId, activityId, activityId]
    );

    return rows.filter((row) => row.Id !== null);
};

export default getPeaksByActivity;
