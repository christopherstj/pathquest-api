import { RowDataPacket } from "mysql2/promise";
import Activity from "../../typeDefs/Activity";
import db from "../getCloudSqlConnection";

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
    if (!bounds && (!search || search.length < 3)) {
        throw new Error("Search query must be at least 3 characters long");
    }

    const clauses: string[] = ["userId = ?"];
    if (bounds) {
        clauses.push(`startLong BETWEEN ? AND ?`, `startLat BETWEEN ? AND ?`);
    }

    if (search) {
        clauses.push(`\`name\` LIKE ?`);
    }

    if (clauses.length < 1) {
        throw new Error("No search parameters provided");
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await db.query<
        (Omit<Activity, "coords"> & { peakSummits: number } & RowDataPacket)[]
    >(
        `
        SELECT a.id, a.startLat, a.startLong, a.distance, a.startTime, a.\`name\`, a.sport, a.timezone, a.gain, COUNT(ap.peakId) peakSummits
        FROM Activity a 
        LEFT JOIN (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap 
        ON ap.activityId = a.id 
        ${whereClause}
        GROUP BY a.id, a.startLat, a.startLong, a.distance, a.startTime, a.\`name\`, a.timezone, a.gain
        `,
        [
            userId,
            ...(bounds
                ? [
                      Math.min(bounds.northWest.lat, bounds.southEast.lat),
                      Math.max(bounds.northWest.lat, bounds.southEast.lat),
                      Math.min(bounds.northWest.lng, bounds.southEast.lng),
                      Math.max(bounds.northWest.lng, bounds.southEast.lng),
                  ]
                : []),
            ...(search ? [`%${search}%`] : []),
        ]
    );

    return rows;
};

export default searchActivities;
