import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";

const getRecentPeakSummits = async (userId: string, peakId: string) => {
    const [ascents] = await db.query<
        ({
            id: string;
            timestamp: string;
            activityId: string;
            timezone?: string;
        } & RowDataPacket)[]
    >(
        `
        SELECT ap.id, ap.\`timestamp\`, ap.activityId, ap.\`timezone\`
        FROM (
            SELECT a.timezone, a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
            LEFT JOIN Activity a ON a.id = ap.activityId
            UNION
            SELECT timezone, userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap
        WHERE peakId = ?
        AND ap.userId = ?
        ORDER BY ap.\`timestamp\` DESC
        LIMIT 3
    `,
        [peakId, userId]
    );

    return ascents;
};

export default getRecentPeakSummits;
