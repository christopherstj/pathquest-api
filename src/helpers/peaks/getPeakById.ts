import { RowDataPacket } from "mysql2";
import Peak from "../../typeDefs/Peak";
import db from "../getCloudSqlConnection";

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
    const [rows] = await db.query<
        (Peak & {
            isFavorited: boolean;
            isSummitted?: boolean;
        } & RowDataPacket)[]
    >(
        `
        SELECT p.*, upf.userId IS NOT NULL isFavorited, COUNT(ap2.id) > 0 isSummitted
        FROM Peak p 
        LEFT JOIN (
            SELECT ap.id, ap.peakId FROM (
                SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
                LEFT JOIN Activity a ON a.id = ap.activityId
                UNION
                SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
            ) ap
            LEFT JOIN Activity a ON ap.activityId = a.id
            WHERE ap.userId = ?
        ) ap2 ON p.Id = ap2.peakId
        LEFT JOIN UserPeakFavorite upf
        ON p.id = upf.peakId
        WHERE p.Id = ?
        GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`, upf.userId
    `,
        [userId, peakId]
    );

    const peak = rows[0] || undefined;

    return peak;
};

export default getPeakById;
