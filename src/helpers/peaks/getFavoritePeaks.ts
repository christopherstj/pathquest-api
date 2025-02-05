import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getFavoritePeaks = async (userId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<
        (Peak & { isFavorited: boolean } & RowDataPacket)[]
    >(
        `
            SELECT p.*, upf.userId IS NOT NULL as isFavorited
            FROM Peak p 
            LEFT JOIN (
                SELECT ap.id, ap.peakId FROM (
                    SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
                    LEFT JOIN Activity a ON a.id = ap.activityId
                    UNION
                    SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
                ) ap
                WHERE ap.userId = ?
            ) ap2 ON p.Id = ap2.peakId
            LEFT JOIN UserPeakFavorite upf
            ON p.id = upf.peakId
            WHERE ap2.id IS NULL
            AND upf.userId = ?
            ORDER BY p.Altitude DESC
        `,
        [userId, userId]
    );

    connection.release();

    return rows;
};

export default getFavoritePeaks;
