import getCloudSqlConnection from "../getCloudSqlConnection";
import ChallengeProgress from "../../typeDefs/ChallengeProgress";

export interface ChallengeProgressWithLastUpdate extends ChallengeProgress {
    lastProgressDate: string | null;
    lastProgressCount: number;
}

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
): Promise<ChallengeProgressWithLastUpdate[]> => {
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
            // Check if ANY peak in the challenge is within the viewport bounds
            // This allows challenges to appear when zoomed in on any of their peaks
            clauses.push(`
                EXISTS (
                    SELECT 1 
                    FROM peaks_challenges pc_bounds
                    INNER JOIN peaks p_bounds ON pc_bounds.peak_id = p_bounds.id
                    WHERE pc_bounds.challenge_id = c.id
                    AND p_bounds.location_coords && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)::geography
                )
            `);
            params.push(
                Math.min(bounds.northWest.lng, bounds.southEast.lng), // minLng
                Math.min(bounds.northWest.lat, bounds.southEast.lat), // minLat
                Math.max(bounds.northWest.lng, bounds.southEast.lng), // maxLng
                Math.max(bounds.northWest.lat, bounds.southEast.lat)  // maxLat
            );
            paramIndex += 4;
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
            clauses.push("COUNT(ps.summitted) = COUNT(p.id)");
        }
        if (types.includes("in-progress")) {
            clauses.push(
                "COUNT(ps.summitted) < COUNT(p.id) AND COUNT(ps.summitted) > 0"
            );
        }
        if (types.includes("not-started")) {
            clauses.push("COUNT(ps.summitted) = 0");
        }

        return clauses.length > 0 ? `HAVING ${clauses.join(" OR ")}` : "";
    };

    const query = `
        WITH user_summits AS (
            SELECT ap.peak_id, ap.timestamp::date as summit_date, ap.timestamp
            FROM (
                SELECT a.user_id, ap.peak_id, ap.timestamp
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION ALL
                SELECT user_id, peak_id, timestamp
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1
        ),
        peak_summits AS (
            SELECT 
                peak_id, 
                COUNT(*) > 0 AS summitted,
                MAX(timestamp) as last_summit_time
            FROM user_summits
            GROUP BY peak_id
        ),
        challenge_last_progress AS (
            SELECT 
                pc.challenge_id,
                us.summit_date as last_progress_date,
                COUNT(*) as peaks_on_date
            FROM user_summits us
            INNER JOIN peaks_challenges pc ON us.peak_id = pc.peak_id
            GROUP BY pc.challenge_id, us.summit_date
        ),
        challenge_most_recent AS (
            SELECT DISTINCT ON (challenge_id)
                challenge_id,
                last_progress_date,
                peaks_on_date
            FROM challenge_last_progress
            ORDER BY challenge_id, last_progress_date DESC
        )
        SELECT 
            c.id, 
            c.name, 
            c.description,
            ST_Y(c.location_coords::geometry) as center_lat, 
            ST_X(c.location_coords::geometry) as center_long, 
            c.region, 
            COUNT(p.id) AS total, 
            COUNT(ps.summitted) AS completed,
            cmr.last_progress_date::text as last_progress_date,
            COALESCE(cmr.peaks_on_date, 0)::int as last_progress_count
        FROM challenges c 
        ${
            favoritesOnly
                ? "LEFT JOIN user_challenge_favorite ucf ON c.id = ucf.challenge_id"
                : ""
        }
        LEFT JOIN peaks_challenges pc ON pc.challenge_id = c.id 
        LEFT JOIN peaks p ON pc.peak_id = p.id
        LEFT JOIN peak_summits ps ON p.id = ps.peak_id
        LEFT JOIN challenge_most_recent cmr ON c.id = cmr.challenge_id
        ${getWhereClause()}
        GROUP BY c.id, c.name, c.description, c.location_coords, c.region, cmr.last_progress_date, cmr.peaks_on_date
        ${getHavingClauses()}
    `;

    const rows = (await db.query(query, params)).rows;

    return rows.map((row: any) => {
        const total = parseInt(row.total) || 0;
        return {
            id: row.id,
            name: row.name,
            description: row.description || "",
            num_peaks: total, // num_peaks is computed from the peaks_challenges join
            center_lat: row.center_lat,
            center_long: row.center_long,
            region: row.region,
            total,
            completed: parseInt(row.completed) || 0,
            lastProgressDate: row.last_progress_date || null,
            lastProgressCount: parseInt(row.last_progress_count) || 0,
        };
    });
};

export default getAllChallenges;
