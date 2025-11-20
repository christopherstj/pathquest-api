import Activity from "../../typeDefs/Activity";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getActivityById = async (
    activityId: string
): Promise<Activity | null> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query<Activity>(
            `
                SELECT a.id, a.title, a.user_id,
                    ARRAY[ST_X(a.start_coords::geometry), ST_Y(a.start_coords::geometry)] as start_coords,
                    a.distance,
                    (SELECT json_agg(json_build_array(ST_X(geom), ST_Y(geom)) ORDER BY path)
                     FROM (SELECT (dp).geom, (dp).path FROM ST_DumpPoints(a.coords::geometry) dp) pts) as coords,
                    a.vert_profile, a.distance_stream, a.time_stream,
                    a.start_time, a.sport, a.timezone, a.gain,
                    pending_reprocess = true AS reprocessing
                FROM activities a
                WHERE a.id = $1
                LIMIT 1
            `,
            [activityId]
        )
    ).rows;

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
};

export default getActivityById;
