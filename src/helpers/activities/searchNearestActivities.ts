import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const searchNearestActivities = async (
    lat: number,
    lng: number,
    userId: string,
    page: number,
    search?: string
) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const rowsPerPage = 50;
    const offset = (page - 1) * rowsPerPage;

    const query = `
        SELECT \`id\`,
            \`startLat\`,
            \`startLong\`,
            \`distance\`,
            \`startTime\`,
            \`sport\`,
            \`name\`,
            \`timezone\`,
            \`gain\`,
            SQRT(POW(? - ABS(startLat), 2) + POW(? - ABS(startLong), 2)) distanceFromPeak
        FROM
            Activity
        WHERE
            userId = ?
            AND startLat IS NOT NULL
            AND startLong IS NOT NULL
            ${search ? `AND name LIKE CONCAT('%', ?, '%')` : ""}
        ORDER BY
            distanceFromPeak ASC
        LIMIT
            ${offset}, ${rowsPerPage}

    `;

    const params = search
        ? [Math.abs(lat ?? 0), Math.abs(lng ?? 0), userId, search]
        : [Math.abs(lat ?? 0), Math.abs(lng ?? 0), userId];

    const [rows] = await connection.query<(Activity & RowDataPacket)[]>(
        query,
        params
    );

    connection.release();

    return rows;
};

export default searchNearestActivities;
