import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getNearbyPeaks = async (
    lat: number,
    lng: number,
    userId?: string
): Promise<Peak[]> => {
    const db = await getCloudSqlConnection();
    const query = userId
        ? `
            SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
            ST_Distance(p.location_coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance,
            upf.user_id IS NOT NULL AS is_favorited, COUNT(ap2.id) AS summits, COUNT(ap3.id) AS public_summits
            FROM peaks p 
            LEFT JOIN (
                SELECT ap.id, ap.peak_id FROM (
                    SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public FROM activities_peaks ap
                    LEFT JOIN activities a ON a.id = ap.activity_id
                    UNION
                    SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
                ) ap
                LEFT JOIN activities a ON ap.activity_id = a.id
                WHERE ap.user_id = $3
            ) ap2 ON p.id = ap2.peak_id
            LEFT JOIN (
                SELECT ap4.id, ap4.peak_id FROM activities_peaks ap4 WHERE ap4.is_public = true
                UNION
                SELECT upm.id, upm.peak_id FROM user_peak_manual upm WHERE upm.is_public = true
            )
            ap3 ON ap3.peak_id = p.id
            LEFT JOIN user_peak_favorite upf
            ON p.id = upf.peak_id
            WHERE p.id = $4
            GROUP BY p.name, p.id, p.location_coords, upf.user_id, p.elevation, p.county, p.state, p.country
        `
        : `
            SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
            ST_Distance(p.location_coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance,
            COUNT(ap.id) AS public_summits
            FROM peaks p
            LEFT JOIN (
                SELECT ap2.id, ap2.peak_id FROM activities_peaks ap2 WHERE ap2.is_public = true
                UNION
                SELECT upm.id, upm.peak_id FROM user_peak_manual upm WHERE upm.is_public = true
            )
            ap ON ap.peak_id = p.id
            WHERE p.id = $3
            GROUP BY p.id
        `;

    const params = userId ? [lng, lat, userId] : [lng, lat];

    const rows = (await db.query(query, params)).rows as Peak[];

    return rows;
};

export default getNearbyPeaks;
