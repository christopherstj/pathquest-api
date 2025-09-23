import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";

const getSummitsByPeakAndActivity = async (
    peakId: string,
    activityId: string
): Promise<
    {
        id: string;
        timestamp: string;
        notes: string;
    }[]
> => {
    const [rows] = await db.query<
        ({ id: string; timestamp: string; notes: string } & RowDataPacket)[]
    >(
        `SELECT ap.id, ap.\`timestamp\`, ap.notes
        FROM Activity a 
        LEFT JOIN (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap ON a.id = ap.activityId 
        LEFT JOIN Peak p ON ap.peakId = p.Id
        WHERE a.id = ? AND p.Id = ?`,
        [activityId, peakId]
    );

    return rows;
};

export default getSummitsByPeakAndActivity;
