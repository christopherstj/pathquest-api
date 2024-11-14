import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getRecentPeakSummits = async (userId: string, peakId: string) => {
    const connection = await getCloudSqlConnection();

    const [ascents] = await connection.query<
        ({
            timestamp: string;
            activityId: string;
            timezone?: string;
        } & RowDataPacket)[]
    >(
        `
        SELECT ap.\`timestamp\`, ap.activityId, a.\`timezone\`
        FROM ActivityPeak ap
        LEFT JOIN Activity a ON ap.activityId = a.id
        WHERE peakId = ?
        AND a.userId = ?
        ORDER BY ap.\`timestamp\` DESC
        LIMIT 3
    `,
        [peakId, userId]
    );

    await connection.end();

    return ascents;
};

export default getRecentPeakSummits;
