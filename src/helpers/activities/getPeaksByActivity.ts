import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeaksByActivity = async (activityId: string): Promise<Peak[]> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT DISTINCT p.*
        FROM activities a 
        LEFT JOIN (
            SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM activities_peaks
            WHERE activity_id = $1
            UNION
            SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
            WHERE activity_id = $1
        ) ap ON a.id = ap.activity_id
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE a.id = $1`,
            [activityId]
        )
    ).rows as Peak[];

    return rows.filter((row) => row.id !== null);
};

export default getPeaksByActivity;
