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
            SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
            LEFT JOIN Activity a ON a.id = ap.activityId
            UNION
            SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap 
        LEFT JOIN Peak p ON ap.peakId = p.Id 
        WHERE ap.userId = ?
        GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`;
    `,
        [userId]
    );

    const promises = rows.map(async (row): Promise<PeakSummit> => {
        const [ascents] = await connection.query<
            ({
                id: string;
                timestamp: string;
                activityId: string;
            } & RowDataPacket)[]
        >(
            `
            SELECT ap.id, \`timestamp\`, activityId
            FROM (
                SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
                LEFT JOIN Activity a ON a.id = ap.activityId
                UNION
                SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
            ) ap
            WHERE peakId = ?
            AND ap.userId = ?
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
