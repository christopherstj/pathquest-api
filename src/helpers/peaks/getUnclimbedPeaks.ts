import { RowDataPacket } from "mysql2/promise";
import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUnclimbedPeaks = async (
    bounds: [[number, number], [number, number]],
    userId: string
) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<
        (Peak & { distance: number; isFavorited: boolean } & RowDataPacket)[]
    >(
        `
            SELECT p.*, upf.userId IS NOT NULL isFavorited
            FROM Peak p 
            LEFT JOIN (
                SELECT ap.id, ap.peakId FROM ActivityPeak ap
                LEFT JOIN Activity a ON ap.activityId = a.id
                WHERE a.userId = ?
            ) ap2 ON p.Id = ap2.peakId
            LEFT JOIN UserPeakFavorite upf
            ON p.id = upf.peakId
            WHERE ap2.id IS NULL
            AND p.Lat BETWEEN ? AND ?
            AND p.\`Long\` BETWEEN ? AND ?
        `,
        [
            userId,
            Math.min(bounds[0][0], bounds[1][0]),
            Math.max(bounds[0][0], bounds[1][0]),
            Math.min(bounds[0][1], bounds[1][1]),
            Math.max(bounds[0][1], bounds[1][1]),
        ]
    );

    await connection.release();

    return rows;
};

export default getUnclimbedPeaks;
