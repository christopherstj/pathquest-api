import { RowDataPacket } from "mysql2";
import PeakSummit from "../../typeDefs/PeakSummit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeakSummits = async (userId: string): Promise<PeakSummit[]> => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<(Peak & RowDataPacket)[]>(
        `
        SELECT p.*
        FROM (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap 
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
                timestamp: string;
                activityId: string;
            } & RowDataPacket)[]
        >(
            `
            SELECT \`timestamp\`, activityId
            FROM (
                SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
                UNION
                SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
            ) ap
            LEFT JOIN Activity a ON ap.activityId = a.id
            WHERE peakId = ?
            AND a.userId = ?
        `,
            [row.Id, userId]
        );

        return {
            ...row,
            ascents,
        };
    });

    const peakSummits = await Promise.all(promises);

    connection.release();

    return peakSummits;
};

export default getPeakSummits;
