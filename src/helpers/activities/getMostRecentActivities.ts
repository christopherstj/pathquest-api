import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const getMostRecentActivities = async (userId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<
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
        ORDER BY a.startTime DESC
        LIMIT 10;
        `,
        [userId]
    );

    connection.release();

    return rows;
};

export default getMostRecentActivities;
