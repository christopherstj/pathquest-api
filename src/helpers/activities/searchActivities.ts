import Activity from "../../typeDefs/Activity";
import getCloudSqlConnection from "../getCloudSqlConnection";

const searchActivities = async (
    userId: string,
    search?: string,
    bounds?: {
        northWest: {
            lat: number;
            lng: number;
        };
        southEast: {
            lat: number;
            lng: number;
        };
    }
) => {
    const db = await getCloudSqlConnection();
    if (!bounds && (!search || search.length < 3)) {
        throw new Error("Search query must be at least 3 characters long");
    }

    const clauses: string[] = ["user_id = $1"];
    let paramIndex = 2;
    const params: any[] = [userId];

    if (bounds) {
        clauses.push(
            `start_long BETWEEN $${paramIndex} AND $${paramIndex + 1}`
        );
        params.push(
            Math.min(bounds.northWest.lng, bounds.southEast.lng),
            Math.max(bounds.northWest.lng, bounds.southEast.lng)
        );
        paramIndex += 2;

        clauses.push(`start_lat BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(
            Math.min(bounds.northWest.lat, bounds.southEast.lat),
            Math.max(bounds.northWest.lat, bounds.southEast.lat)
        );
        paramIndex += 2;
    }

    if (search) {
        clauses.push(`title LIKE $${paramIndex}`);
        params.push(`%${search}%`);
        paramIndex++;
    }

    if (clauses.length < 1) {
        throw new Error("No search parameters provided");
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = (
        await db.query(
            `
        SELECT a.id,
            ARRAY[ST_X(a.start_coords::geometry), ST_Y(a.start_coords::geometry)] as start_coords,
            a.distance, a.start_time, a.title, a.sport, a.timezone, a.gain,
            COUNT(ap.peak_id) AS peak_summits
        FROM activities a 
        LEFT JOIN (
            SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM activities_peaks
            UNION
            SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
        ) ap 
        ON ap.activity_id = a.id 
        ${whereClause}
        GROUP BY a.id, a.start_coords, a.distance, a.start_time, a.title, a.timezone, a.gain
        `,
            params
        )
    ).rows as Activity[];

    return rows;
};

export default searchActivities;
