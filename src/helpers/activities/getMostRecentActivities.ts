import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const getMostRecentActivities = async (userId: string) => {
    const connection = await getCloudSqlConnection();

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
        LEFT JOIN ActivityPeak ap
        ON a.id = ap.activityId
        WHERE userId = ?
        GROUP BY a.id
        ORDER BY a.startTime DESC
        LIMIT 10;
        `,
        [userId]
    );

    await connection.end();

    return rows;
};

export default getMostRecentActivities;
