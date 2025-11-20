import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByPeakAndActivity = async (
    peakId: string,
    activityId: string
): Promise<
    {
        id: string;
        timestamp: string;
        notes: string;
    }[]
> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT ap.id, ap.timestamp, ap.notes
            FROM activities a 
            LEFT JOIN (
                SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM activities_peaks
                UNION
                SELECT id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
            ) ap ON a.id = ap.activity_id 
            LEFT JOIN peaks p ON ap.peak_id = p.id
            WHERE a.id = $1 AND p.id = $2`,
            [activityId, peakId]
        )
    ).rows as {
        id: string;
        timestamp: string;
        notes: string;
    }[];

    return rows;
};

export default getSummitsByPeakAndActivity;
