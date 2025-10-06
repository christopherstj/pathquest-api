import { RowDataPacket } from "mysql2";
import Peak from "../../typeDefs/Peak";
import db from "../getCloudSqlConnection";

const getNearbyPeaks = async (
    lat: number,
    lng: number,
    userId?: string
): Promise<Peak[]> => {
    const query = userId
        ? `
            SELECT p.*,
            SQRT(POW(? - ABS(p.Lat), 2) + POW(? - ABS(p.\`Long\`), 2)) distance,
            upf.userId IS NOT NULL isFavorited, COUNT(ap2.id) summits, COUNT(ap3.id) publicSummits
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
            LEFT JOIN (
                SELECT ap4.id, ap4.peakId FROM ActivityPeak ap4 WHERE ap4.isPublic = 1
                UNION
                SELECT upm.id, upm.peakId FROM UserPeakManual upm WHERE upm.isPublic = 1
            )
            ap3 ON ap3.peakId = p.Id
            LEFT JOIN UserPeakFavorite upf
            ON p.id = upf.peakId
            WHERE p.Id = ?
            GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`, upf.userId
        `
        : `
            SELECT p.*, 
            SQRT(POW(? - ABS(p.Lat), 2) + POW(? - ABS(p.\`Long\`), 2)) distance,
            COUNT(ap.id) publicSummits
            FROM Peak p
            LEFT JOIN (
                SELECT ap2.id, ap2.peakId FROM ActivityPeak ap2 WHERE ap2.isPublic = 1
                UNION
                SELECT upm.id, upm.peakId FROM UserPeakManual upm WHERE upm.isPublic = 1
            )
            ap ON ap.peakId = p.Id
            WHERE p.Id = ?
            GROUP BY p.Id
        `;

    const params = userId
        ? [Math.abs(lat ?? 0), Math.abs(lng ?? 0), userId]
        : [Math.abs(lat ?? 0), Math.abs(lng ?? 0)];

    const [rows] = await db.query<(Peak & RowDataPacket)[]>(query, params);

    return rows;
};

export default getNearbyPeaks;
