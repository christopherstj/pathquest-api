import { RowDataPacket } from "mysql2";
import PeakSummit from "../../typeDefs/PeakSummit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeakSummits = async (userId: string) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<(Peak & RowDataPacket)[]>(
        `
        SELECT p.*
        FROM ActivityPeak ap 
        LEFT JOIN Peak p ON ap.peakId = p.Id 
        LEFT JOIN Activity a ON ap.activityId = a.id 
        WHERE a.userId = ?
        GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`;
    `,
        [userId]
    );

    const promises = rows.map(async (row): Promise<PeakSummit> => {
        const [ascents] = await connection.query<
            ({
                timestamp: number;
                activityId: string;
            } & RowDataPacket)[]
        >(
            `
            SELECT \`timestamp\`, activityId
            FROM ActivityPeak
            WHERE peakId = ?;
        `,
            [row.Id]
        );

        return {
            ...row,
            ascents,
        };
    });

    const peakSummits = await Promise.all(promises);

    return peakSummits;
};

export default getPeakSummits;
