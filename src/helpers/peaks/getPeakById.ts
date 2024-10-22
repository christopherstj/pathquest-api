import { RowDataPacket } from "mysql2";
import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getPeakById = async (
    peakId: string,
    userId: string
): Promise<
    | (Peak & {
          isFavorited: boolean;
          isSummitted?: boolean;
      })
    | undefined
> => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<
        (Peak & {
            isFavorited: boolean;
            isSummitted?: boolean;
        } & RowDataPacket)[]
    >(
        `
        SELECT p.*, upf.userId IS NOT NULL isFavorited, COUNT(ap2.id) > 0 isSummitted
            FROM Peak p 
            LEFT JOIN (
                SELECT ap.id, ap.peakId FROM ActivityPeak ap
                LEFT JOIN Activity a ON ap.activityId = a.id
                WHERE a.userId = ?
            ) ap2 ON p.Id = ap2.peakId
            LEFT JOIN UserPeakFavorite upf
            ON p.id = upf.peakId
            WHERE p.Id = ?
            GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`, upf.userId
    `,
        [userId, peakId]
    );

    const peak = rows[0] || undefined;

    connection.release();

    return peak;
};

export default getPeakById;
