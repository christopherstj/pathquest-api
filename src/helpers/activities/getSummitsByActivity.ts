import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByActivity = async (activityId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT ap.id, ap.timestamp FROM activities a LEFT JOIN (
            SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM activities_peaks
            UNION
            SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
        ) ap ON a.id = ap.activity_id WHERE a.id = $1`,
            [activityId]
        )
    ).rows as { id: string; timestamp: string }[];

    return rows;
};

export default getSummitsByActivity;
