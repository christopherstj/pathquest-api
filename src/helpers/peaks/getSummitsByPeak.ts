import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByPeak = async (peakId: string, userId: string) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<
        ({
            timestamp: number;
            activityId: string;
        } & RowDataPacket)[]
    >(
        `
            SELECT \`timestamp\`, activityId
            FROM ActivityPeak ap
            LEFT JOIN Activity a ON ap.activityId = a.id
            WHERE peakId = ?
            AND a.userId = ?
        `,
        [peakId, userId]
    );

    await connection.end();

    return rows;
};

export default getSummitsByPeak;