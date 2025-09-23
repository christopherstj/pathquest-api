import { RowDataPacket } from "mysql2";
import ManualPeakSummit from "../../typeDefs/ManualPeakSummit";
import Peak from "../../typeDefs/Peak";
import db from "../getCloudSqlConnection";

const getRecentSummits = async (
    userId: string
): Promise<(Peak & ManualPeakSummit)[]> => {
    const [rows] = await db.query<(Peak & ManualPeakSummit & RowDataPacket)[]>(
        `
        SELECT ap.*, p.* FROM (
            SELECT a1.userId, ap1.id, ap1.\`timestamp\`, ap1.activityId, ap1.peakId, ap1.notes, ap1.isPublic FROM ActivityPeak ap1
            LEFT JOIN Activity a1 ON ap1.activityId = a1.id
            UNION
            SELECT userId, id, \`timestamp\`, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap
        LEFT JOIN Peak p ON ap.peakId = p.Id
        WHERE ap.userId = ?
        ORDER BY ap.\`timestamp\` DESC
        LIMIT 100;    
    `,
        [userId]
    );

    return rows;
};

export default getRecentSummits;
