import { format, RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const searchNearestPeaks = async (
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
        SELECT p.*,
            SQRT(POW(? - ABS(p.Lat), 2) + POW(? - ABS(p.\`Long\`), 2)) distanceFromActivity,
            upf.userId IS NOT NULL isFavorited,
            COUNT(ap2.id) > 0 isSummitted
        FROM
            Peak p
            LEFT JOIN (
                SELECT ap.id, ap.peakId FROM (
                    SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
                    UNION
                    SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
                ) ap
                LEFT JOIN Activity a ON ap.activityId = a.id
                WHERE a.userId = ?
            ) ap2 ON p.Id = ap2.peakId
            LEFT JOIN UserPeakFavorite upf
            ON p.id = upf.peakId
        WHERE
            p.Lat IS NOT NULL
            AND p.\`Long\` IS NOT NULL
            ${search ? `AND p.\`name\` LIKE CONCAT('%', ?, '%')` : ""}
        GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`, upf.userId
        ORDER BY
            distanceFromActivity ASC
        LIMIT
            ${offset}, ${rowsPerPage}

    `;

    const params = search
        ? [Math.abs(lat ?? 0), Math.abs(lng ?? 0), userId, search]
        : [Math.abs(lat ?? 0), Math.abs(lng ?? 0), userId];

    console.log(format(query, params));

    const [rows] = await connection.query<
        (Peak & {
            isFavorited: boolean;
            isSummitted?: boolean;
        } & RowDataPacket)[]
    >(query, params);

    connection.release();

    return rows;
};

export default searchNearestPeaks;
