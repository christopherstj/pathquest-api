import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import getUser from "../user/getUser";
import Peak from "../../typeDefs/Peak";

const getNearestUnclimbedPeaks = async (userId: string) => {
    const connection = await getCloudSqlConnection();

    const user = await getUser(userId);

    if (!user) {
        return [];
    }

    if (user.lat !== null && user.long !== null) {
        const [rows] = await connection.query<
            (Peak & {
                distance: number;
                isFavorited: boolean;
            } & RowDataPacket)[]
        >(
            `
            SELECT p.*, SQRT(POW(? - ABS(p.Lat), 2) + POW(? - ABS(p.\`Long\`), 2)) distance, upf.userId IS NOT NULL isFavorited
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
            ORDER BY distance ASC LIMIT 100;
        `,
            [Math.abs(user.lat ?? 0), Math.abs(user.long ?? 0), userId]
        );

        await connection.end();

        return rows;
    } else {
        const [rows] = await connection.query<
            (Peak & {
                distance: number;
                isFavorited: boolean;
            } & RowDataPacket)[]
        >(
            `
            SELECT p.*, 0 distance, upf.userId IS NOT NULL isFavorited
            FROM Peak p 
            LEFT JOIN (
                SELECT ap.id, ap.peakId FROM ActivityPeak ap
                LEFT JOIN Activity a ON ap.activityId = a.id
                WHERE a.userId = ?
            ) ap2 ON p.Id = ap2.peakId
            LEFT JOIN UserPeakFavorite upf
            ON p.id = upf.peakId
            WHERE ap2.id IS NULL
            ORDER BY p.Altitude DESC LIMIT 100;
        `,
            [userId]
        );

        await connection.end();

        return rows;
    }
};

export default getNearestUnclimbedPeaks;
