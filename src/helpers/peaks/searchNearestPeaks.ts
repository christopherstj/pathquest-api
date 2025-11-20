import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const searchNearestPeaks = async (
    lat: number,
    lng: number,
    userId: string,
    page: number,
    search?: string
) => {
    const db = await getCloudSqlConnection();
    const rowsPerPage = 50;
    const offset = (page - 1) * rowsPerPage;

    const query = `
        SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
            ST_Distance(p.location_coords, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_from_activity,
            upf.user_id IS NOT NULL AS is_favorited,
            COUNT(ap2.id) AS summits
        FROM
            peaks p
            LEFT JOIN (
                SELECT ap.id, ap.peak_id FROM (
                    SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public FROM activities_peaks ap
                    LEFT JOIN activities a ON a.id = ap.activity_id
                    UNION
                    SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
                ) ap
                WHERE ap.user_id = $3
            ) ap2 ON p.id = ap2.peak_id
            LEFT JOIN user_peak_favorite upf
            ON p.id = upf.peak_id
        WHERE
            p.location_coords IS NOT NULL
            ${search ? `AND p.name LIKE $4` : ""}
        GROUP BY p.name, p.id, p.location_coords, upf.user_id, p.elevation, p.county, p.state, p.country
        ORDER BY
            distance_from_activity ASC
        LIMIT
            ${rowsPerPage}
        OFFSET
            ${offset}

    `;

    const params = search
        ? [lat, lng, userId, `%${search}%`]
        : [lat, lng, userId];

    const rows = (await db.query(query, params)).rows as Peak[];

    return rows;
};

export default searchNearestPeaks;
