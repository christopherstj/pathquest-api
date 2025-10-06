import { RowDataPacket } from "mysql2";
import user from "../../routes/user";
import Peak from "../../typeDefs/Peak";
import db from "../getCloudSqlConnection";
import { format } from "mysql2";

const searchPeaks = async (
    bounds?: [[number, number], [number, number]],
    userId?: string,
    search?: string,
    showSummittedPeaks?: boolean,
    page?: number,
    pageSize?: number
): Promise<Peak[]> => {
    const getWhereClause = () => {
        const clauses = [];
        if (bounds) {
            clauses.push("p.Lat BETWEEN ? AND ? AND p.`Long` BETWEEN ? AND ?");
        }
        if (search) {
            clauses.push("p.Name LIKE ?");
        }
        if (!showSummittedPeaks && userId) {
            clauses.push("ap2.id IS NULL");
        }
        return clauses.length > 0 ? "WHERE " + clauses.join(" AND ") : "";
    };

    const query = `
        SELECT p.*${userId ? ", upf.userId IS NOT NULL isFavorited" : ""}
        ${userId && showSummittedPeaks ? ", COUNT(ap2.id) summits" : ""}
        , COUNT(ap3.id) publicSummits
        FROM Peak p 
        ${
            userId
                ? `LEFT JOIN (
                        SELECT ap.id, ap.peakId FROM (
                            SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
                            LEFT JOIN Activity a ON a.id = ap.activityId
                            UNION
                            SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
                        ) ap
                        WHERE ap.userId = ?
                    ) ap2 ON p.Id = ap2.peakId
                    LEFT JOIN UserPeakFavorite upf
                    ON p.id = upf.peakId`
                : ""
        }
        LEFT JOIN (
            SELECT ap4.id, ap4.peakId FROM ActivityPeak ap4 WHERE ap4.isPublic = 1
            UNION
            SELECT upm.id, upm.peakId FROM UserPeakManual upm WHERE upm.isPublic = 1
        )
        ap3 ON ap3.peakId = p.Id
        ${getWhereClause()}
        GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`${
            userId ? ", upf.userId" : ""
        }
        ORDER BY p.Altitude DESC
        ${page && pageSize ? "LIMIT ? OFFSET ?" : ""}
    `;

    const params = [
        ...(userId ? [userId] : []),
        ...(bounds
            ? [
                  Math.min(bounds[0][0], bounds[1][0]),
                  Math.max(bounds[0][0], bounds[1][0]),
                  Math.min(bounds[0][1], bounds[1][1]),
                  Math.max(bounds[0][1], bounds[1][1]),
              ]
            : []),
        ...(search ? [`%${search}%`] : []),
        ...(page && pageSize ? [pageSize, (page - 1) * pageSize] : []),
    ];

    const [peaks] = await db.query<(Peak & RowDataPacket)[]>(query, params);

    return peaks;
};

export default searchPeaks;
