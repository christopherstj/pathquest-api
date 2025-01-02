import mysql, { RowDataPacket } from "mysql2/promise";
import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUnclimbedPeaks = async (
    userId: string,
    bounds?: [[number, number], [number, number]],
    search?: string,
    showSummittedPeaks?: boolean
) => {
    const connection = await getCloudSqlConnection();

    if (!bounds && !search) {
        return [];
    }

    const getWhereClause = () => {
        if (!showSummittedPeaks && bounds && search) {
            return "WHERE ap2.id IS NULL AND p.Name LIKE ? AND p.Lat BETWEEN ? AND ? AND p.`Long` BETWEEN ? AND ?";
        } else if (!showSummittedPeaks && bounds) {
            return "WHERE ap2.id IS NULL AND p.Lat BETWEEN ? AND ? AND p.`Long` BETWEEN ? AND ?";
        } else if (!showSummittedPeaks && search) {
            return "WHERE ap2.id IS NULL AND p.Name LIKE ?";
        } else if (bounds && search) {
            return "WHERE p.Name LIKE ? AND p.Lat BETWEEN ? AND ? AND p.`Long` BETWEEN ? AND ?";
        } else if (bounds) {
            return "WHERE p.Lat BETWEEN ? AND ? AND p.`Long` BETWEEN ? AND ?";
        } else if (search) {
            return "WHERE p.Name LIKE ?";
        } else {
            return "";
        }
    };

    const query = `
            SELECT p.*, upf.userId IS NOT NULL isFavorited${
                showSummittedPeaks ? ", COUNT(ap2.id) > 0 isSummitted" : ""
            }
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
            ${getWhereClause()}
            GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`, upf.userId
            ORDER BY p.Altitude DESC;
        `;

    const [rows] = await connection.query<
        (Peak & {
            isFavorited: boolean;
            isSummitted?: boolean;
        } & RowDataPacket)[]
    >(query, [
        userId,
        ...(search ? [`%${search}%`] : []),
        ...(bounds
            ? [
                  Math.min(bounds[0][0], bounds[1][0]),
                  Math.max(bounds[0][0], bounds[1][0]),
                  Math.min(bounds[0][1], bounds[1][1]),
                  Math.max(bounds[0][1], bounds[1][1]),
              ]
            : []),
    ]);

    await connection.end();

    return rows;
};

export default getUnclimbedPeaks;
