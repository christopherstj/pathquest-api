import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getFavoritePeaks = async (userId: string) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<
        (Peak & { isFavorited: boolean } & RowDataPacket)[]
    >(
        `
            SELECT p.*, upf.userId IS NOT NULL as isFavorited
            FROM Peak p 
            LEFT JOIN (
                SELECT ap.id, ap.peakId FROM (
                    SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
                    UNION
                    SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
                ) ap
                LEFT JOIN Activity a ON ap.activityId = a.id
                WHERE a.userId = ?
            ) ap2 ON p.Id = ap2.peakId
            LEFT JOIN UserPeakFavorite upf
            ON p.id = upf.peakId
            WHERE ap2.id IS NULL
            AND upf.userId = ?
            ORDER BY p.Altitude DESC
        `,
        [userId, userId]
    );

    await connection.end();

    return rows;
};

export default getFavoritePeaks;
