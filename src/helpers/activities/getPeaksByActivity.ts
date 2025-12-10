import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeaksByActivity = async (activityId: string): Promise<Peak[]> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT DISTINCT ON (p.id)
                p.id, p.name, p.elevation, p.county, p.state, p.country,
                ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords
            FROM activities a 
            LEFT JOIN (
                SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM activities_peaks
                WHERE activity_id = $1
                UNION
                SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
                WHERE activity_id = $1
            ) ap ON a.id = ap.activity_id
            LEFT JOIN peaks p ON ap.peak_id = p.id
            WHERE a.id = $1 AND p.id IS NOT NULL`,
            [activityId]
        )
    ).rows as Peak[];

    return rows;
};

export default getPeaksByActivity;
