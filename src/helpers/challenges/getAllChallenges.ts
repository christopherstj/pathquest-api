import getCloudSqlConnection from "../getCloudSqlConnection";
import ChallengeProgress from "../../typeDefs/ChallengeProgress";

const getAllChallenges = async (
    userId: string,
    types: ("completed" | "in-progress" | "not-started")[],
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
    const db = await getCloudSqlConnection();

    const params: any[] = [userId];
    let paramIndex = 2;

    const getWhereClause = () => {
        const clauses = [] as string[];

        if (search) {
            // Search both name and region fields with case-insensitive matching
            clauses.push(`(c.name ILIKE $${paramIndex} OR c.region ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (bounds) {
            clauses.push(
                `ST_Y(c.location_coords::geometry) BETWEEN $${paramIndex} AND $${paramIndex + 1}`
            );
            params.push(
                Math.min(bounds.northWest.lat, bounds.southEast.lat),
                Math.max(bounds.northWest.lat, bounds.southEast.lat)
            );
            paramIndex += 2;

            clauses.push(
                `ST_X(c.location_coords::geometry) BETWEEN $${paramIndex} AND $${paramIndex + 1}`
            );
            params.push(
                Math.min(bounds.northWest.lng, bounds.southEast.lng),
                Math.max(bounds.northWest.lng, bounds.southEast.lng)
            );
            paramIndex += 2;
        }

        if (favoritesOnly) {
            clauses.push(`ucf.user_id = $${paramIndex}`);
            params.push(userId);
            paramIndex++;
        }

        return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    };

    const getHavingClauses = () => {
        const clauses = [] as string[];

        if (types.includes("completed")) {
            clauses.push("COUNT(ap2.summitted) = COUNT(p.id)");
        }
        if (types.includes("in-progress")) {
            clauses.push(
                "COUNT(ap2.summitted) < COUNT(p.id) AND COUNT(ap2.summitted) > 0"
            );
        }
        if (types.includes("not-started")) {
            clauses.push("COUNT(ap2.summitted) = 0");
        }

        return clauses.length > 0 ? `HAVING ${clauses.join(" OR ")}` : "";
    };

    const query = `
        SELECT c.id, c.name, ST_Y(c.location_coords::geometry) as center_lat, ST_X(c.location_coords::geometry) as center_long, c.region, COUNT(p.id) AS total, COUNT(ap2.summitted) AS completed 
        FROM challenges c 
        ${
            favoritesOnly
                ? "LEFT JOIN user_challenge_favorite ucf ON c.id = ucf.challenge_id"
                : ""
        }
        LEFT JOIN peaks_challenges pc ON pc.challenge_id = c.id 
        LEFT JOIN peaks p ON pc.peak_id = p.id
        LEFT JOIN 
            (
                SELECT ap.peak_id, COUNT(ap.peak_id) > 0 AS summitted FROM (
                    SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public FROM activities_peaks ap
                    LEFT JOIN activities a ON a.id = ap.activity_id
                    UNION
                    SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
                ) ap
                WHERE ap.user_id = $1
                GROUP BY ap.peak_id
            ) ap2 ON p.id = ap2.peak_id
        ${getWhereClause()}
        GROUP BY c.id, c.name, c.location_coords, c.region
        ${getHavingClauses()}
    `;

    const rows = (await db.query(query, params)).rows as ChallengeProgress[];

    return rows;
};

export default getAllChallenges;
