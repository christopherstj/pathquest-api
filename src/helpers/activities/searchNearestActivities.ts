import getCloudSqlConnection from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const searchNearestActivities = async (
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
        SELECT id,
            ARRAY[ST_X(start_coords::geometry), ST_Y(start_coords::geometry)] as start_coords,
            distance,
            start_time,
            sport,
            title,
            timezone,
            gain,
            ST_Distance(start_coords, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_from_peak
        FROM
            activities
        WHERE
            user_id = $3
            AND start_coords IS NOT NULL
            ${search ? `AND title LIKE $4` : ""}
        ORDER BY
            distance_from_peak ASC
        LIMIT
            ${rowsPerPage}
        OFFSET
            ${offset}

    `;

    const params = search
        ? [lat, lng, userId, `%${search}%`]
        : [lat, lng, userId];

    const rows = (await db.query(query, params)).rows as Activity[];

    return rows;
};

export default searchNearestActivities;
