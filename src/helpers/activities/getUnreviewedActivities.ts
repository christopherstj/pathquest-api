import getCloudSqlConnection from "../getCloudSqlConnection";

export interface UnreviewedActivity {
    id: string;
    display_title: string | null;
    title: string;
    start_time: string;
    timezone: string | null;
    sport: string | null;
    summit_count: number;
    peak_names: string[];
}

const getUnreviewedActivities = async (
    userId: string,
    limit: number = 10
): Promise<UnreviewedActivity[]> => {
    const db = await getCloudSqlConnection();

    const result = await db.query<UnreviewedActivity>(
        `
        SELECT 
            a.id,
            a.display_title,
            a.title,
            a.start_time,
            a.timezone,
            a.sport,
            COUNT(ap.id)::int as summit_count,
            ARRAY_AGG(p.name ORDER BY ap.timestamp) as peak_names
        FROM activities a
        INNER JOIN activities_peaks ap ON a.id = ap.activity_id
        INNER JOIN peaks p ON ap.peak_id = p.id
        WHERE a.user_id = $1
          AND (a.is_reviewed IS NULL OR a.is_reviewed = FALSE)
          AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
        GROUP BY a.id, a.display_title, a.title, a.start_time, a.timezone, a.sport
        ORDER BY a.start_time DESC
        LIMIT $2
        `,
        [userId, limit]
    );

    return result.rows;
};

export default getUnreviewedActivities;
