import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";

const getSummitsByPeak = async (peakId: string, userId: string) => {
    const [rows] = await db.query<
        ({
            id: string;
            timestamp: string;
            activityId: string;
            notes?: string;
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

    return rows;
};

export default getSummitsByPeak;
