import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByPeakAndActivity = async (
    peakId: string,
    activityId: string
): Promise<
    {
        id: string;
        timestamp: string;
        notes: string;
        difficulty?: string;
        experience_rating?: string;
    }[]
> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT ap.id, ap.timestamp, ap.notes, ap.difficulty, ap.experience_rating
            FROM activities a 
            LEFT JOIN (
                SELECT id, timestamp, activity_id, peak_id, notes, is_public, difficulty, experience_rating, condition_tags, custom_condition_tags FROM activities_peaks
                UNION
                SELECT id, timestamp, activity_id, peak_id, notes, is_public, difficulty, experience_rating, condition_tags, custom_condition_tags FROM user_peak_manual
            ) ap ON a.id = ap.activity_id 
            LEFT JOIN peaks p ON ap.peak_id = p.id
            WHERE a.id = $1 AND p.id = $2`,
            [activityId, peakId]
        )
    ).rows as {
        id: string;
        timestamp: string;
        notes: string;
        difficulty?: string;
        experience_rating?: string;
    }[];

    return rows;
};

export default getSummitsByPeakAndActivity;
