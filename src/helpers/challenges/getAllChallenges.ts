import { format, RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Challenge from "../../typeDefs/Challenge";
import ChallengeProgress from "../../typeDefs/ChallengeProgress";

const getAllChallenges = async (
    userId: string,
    type: "completed" | "in-progress" | "not-started",
    bounds?: {
        northWest: {
            lat: number;
            lng: number;
        };
        southEast: {
            lat: number;
            lng: number;
        };
    },
    search?: string,
    favoritesOnly: boolean = false
) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const getWhereClause = () => {
        const clauses = [] as string[];

        if (search) {
            clauses.push("c.`name` LIKE ?");
        }
        if (bounds) {
            clauses.push(
                "c.centerLat BETWEEN ? AND ? AND c.centerLong BETWEEN ? AND ?"
            );
        }

        return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    };

    const getHavingClauses = () => {
        const clauses = [] as string[];

        if (type === "completed") {
            clauses.push("completed = total");
        } else if (type === "in-progress") {
            clauses.push("completed < total AND completed > 0");
        } else if (type === "not-started") {
            clauses.push("completed = 0");
        }

        return clauses.length > 0 ? `HAVING ${clauses.join(" AND ")}` : "";
    };

    const query = `
        SELECT c.id, c.\`name\`, c.centerLat, c.centerLong, c.region, COUNT(p.Id) total, COUNT(ap2.summitted) completed 
        FROM Challenge c 
        ${
            favoritesOnly
                ? "LEFT JOIN UserChallengeFavorite ucf ON c.id = ucf.challengeId"
                : ""
        }
        LEFT JOIN PeakChallenge pc ON pc.challengeId = c.id 
        LEFT JOIN Peak p ON pc.peakId = p.Id
        LEFT JOIN 
            (
                SELECT ap.peakId, COUNT(ap.peakId) > 0 summitted FROM (
                    SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
                    LEFT JOIN Activity a ON a.id = ap.activityId
                    UNION
                    SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
                ) ap
                WHERE ap.userId = ?
                GROUP BY ap.peakId
            ) ap2 ON p.Id = ap2.peakId
        ${getWhereClause()}
        GROUP BY c.id, c.\`name\`, c.centerLat, c.centerLong
        ${getHavingClauses()};
    `;

    const [rows] = await connection.query<
        (ChallengeProgress & RowDataPacket)[]
    >(query, [
        userId,
        ...(search ? [`%${search}%`] : []),
        ...(bounds
            ? [
                  Math.min(bounds.northWest.lat, bounds.southEast.lat),
                  Math.max(bounds.northWest.lat, bounds.southEast.lat),
                  Math.min(bounds.northWest.lng, bounds.southEast.lng),
                  Math.max(bounds.northWest.lng, bounds.southEast.lng),
              ]
            : []),
    ]);

    connection.release();

    return rows;
};

export default getAllChallenges;
