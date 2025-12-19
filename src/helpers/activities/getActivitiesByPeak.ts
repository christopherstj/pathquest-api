import getCloudSqlConnection from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const getActivityByPeak = async (
    peakId: string,
    userId: string,
    justCoords: boolean = false
) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query<Activity>(
            `SELECT a.id, a.title, a.user_id,
                ARRAY[ST_X(a.start_coords::geometry), ST_Y(a.start_coords::geometry)] as start_coords,
                a.distance,
                (SELECT json_agg(json_build_array(ST_X(geom), ST_Y(geom)))
                 FROM (SELECT (dp).geom, (dp).path FROM ST_DumpPoints(a.coords::geometry) dp ORDER BY (dp).path) pts) as coords,
                a.start_time, a.sport, a.timezone, a.gain${
                    !justCoords
                        ? ", a.vert_profile, a.distance_stream, a.time_stream"
                        : ""
                } FROM (
                    SELECT activity_id, peak_id 
                    FROM activities_peaks
                    WHERE COALESCE(confirmation_status, 'auto_confirmed') != 'denied'
                    UNION
                    SELECT activity_id, peak_id 
                    FROM user_peak_manual 
                    WHERE activity_id IS NOT NULL
                ) ap 
                LEFT JOIN activities a ON ap.activity_id = a.id 
                WHERE ap.peak_id = $1 AND a.user_id = $2
                GROUP BY a.id, a.title, a.user_id, a.start_coords, a.distance, a.coords, a.start_time, a.sport, a.timezone, a.gain${
                    !justCoords
                        ? ", a.vert_profile, a.distance_stream, a.time_stream"
                        : ""
                }`,
            [peakId, userId]
        )
    ).rows;

    return rows.map((activity) => ({
        ...activity,
        distance: activity.distance ? Number(activity.distance) : undefined,
        gain: activity.gain ? Number(activity.gain) : undefined,
    }));
};

export default getActivityByPeak;
