import getCloudSqlConnection from "../getCloudSqlConnection";
import getUser from "../user/getUser";
import Peak from "../../typeDefs/Peak";

const getNearestUnclimbedPeaks = async (userId: string) => {
    const db = await getCloudSqlConnection();
    const user = await getUser(userId);

    if (!user) {
        return [];
    }

    if (user.location_coords) {
        const rows = (
            await db.query(
                `
            SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
            ST_Distance(p.location_coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance,
            upf.user_id IS NOT NULL AS is_favorited
            FROM peaks p 
            LEFT JOIN (
                SELECT ap.id, ap.peak_id FROM (
                    SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public 
                    FROM activities_peaks ap
                    LEFT JOIN activities a ON a.id = ap.activity_id
                    WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                    UNION
                    SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public 
                    FROM user_peak_manual
                ) ap
                WHERE ap.user_id = $3
            ) ap2 ON p.id = ap2.peak_id
            LEFT JOIN user_peak_favorite upf
            ON p.id = upf.peak_id
            WHERE ap2.id IS NULL
            ORDER BY distance ASC LIMIT 100
        `,
                [user.location_coords[0], user.location_coords[1], userId]
            )
        ).rows as Peak[];
        return rows;
    } else {
        const rows = (
            await db.query(
                `
            SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
            0 AS distance, upf.user_id IS NOT NULL AS is_favorited
            FROM peaks p 
            LEFT JOIN (
                SELECT ap.id, ap.peak_id 
                FROM activities_peaks ap
                LEFT JOIN activities a ON ap.activity_id = a.id
                WHERE a.user_id = $1
                AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            ) ap2 ON p.id = ap2.peak_id
            LEFT JOIN user_peak_favorite upf
            ON p.id = upf.peak_id
            WHERE ap2.id IS NULL
            ORDER BY p.elevation DESC LIMIT 100
        `,
                [userId]
            )
        ).rows as Peak[];
        return rows;
    }
};

export default getNearestUnclimbedPeaks;
