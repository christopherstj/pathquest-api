import { RowDataPacket, format } from "mysql2";
import db from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const getMostRecentActivities = async (
    userId: string,
    summitsOnly: boolean
) => {
    const [rows] = await db.query<
        (Activity & { peakSummits: number } & RowDataPacket)[]
    >(
        `
        SELECT a.\`id\`,
            a.\`startLat\`,
            a.\`startLong\`,
            a.\`distance\`,
            a.\`startTime\`,
            a.\`sport\`,
            a.\`name\`,
            a.\`timezone\`,
            a.\`gain\`,
            COUNT(ap.id) peakSummits
        FROM \`Activity\` a
        LEFT JOIN (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap
        ON a.id = ap.activityId
        WHERE userId = ?
        GROUP BY a.id
        ${summitsOnly ? "HAVING peakSummits > 0" : ""}
        ORDER BY a.startTime DESC
        LIMIT 20;
        `,
        [userId]
    );

    return rows;
};

export default getMostRecentActivities;
