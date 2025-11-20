import getCloudSqlConnection from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const getMostRecentActivities = async (
    userId: string,
    summitsOnly: boolean
) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `
        SELECT a.id,
            ARRAY[ST_X(a.start_coords::geometry), ST_Y(a.start_coords::geometry)] as start_coords,
            a.distance,
            a.start_time,
            a.sport,
            a.title,
            a.timezone,
            a.gain,
            COUNT(ap.id) AS peak_summits
        FROM activities a
        LEFT JOIN (
            SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM activities_peaks
            UNION
            SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
        ) ap
        ON a.id = ap.activity_id
        WHERE user_id = $1
        GROUP BY a.id
        ${summitsOnly ? "HAVING COUNT(ap.id) > 0" : ""}
        ORDER BY a.start_time DESC
        LIMIT 20
        `,
            [userId]
        )
    ).rows as (Activity & { peak_summits: number })[];

    return rows;
};

export default getMostRecentActivities;
