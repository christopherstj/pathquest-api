import getCloudSqlConnection from "../getCloudSqlConnection";

const getRecentPeakSummits = async (userId: string, peakId: string) => {
    const db = await getCloudSqlConnection();
    const ascents = (
        await db.query(
            `
        SELECT ap.id, ap.timestamp, ap.activity_id, ap.timezone
        FROM (
            SELECT a.timezone, a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public 
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION
            SELECT timezone, user_id, id, timestamp, activity_id, peak_id, notes, is_public 
            FROM user_peak_manual
        ) ap
        WHERE peak_id = $1
        AND ap.user_id = $2
        ORDER BY ap.timestamp DESC
        LIMIT 3
    `,
            [peakId, userId]
        )
    ).rows as {
        id: string;
        timestamp: string;
        activity_id: string;
        timezone?: string;
    }[];

    return ascents;
};

export default getRecentPeakSummits;
