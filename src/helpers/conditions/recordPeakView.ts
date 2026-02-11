import getCloudSqlConnection from "../getCloudSqlConnection";

/**
 * Record that a peak was viewed, for smart fetching priority.
 * Upserts peak_fetch_priority with updated view time and count.
 * Fire-and-forget — errors are logged but don't affect the caller.
 */
const recordPeakView = async (peakId: string): Promise<void> => {
    try {
        const db = await getCloudSqlConnection();
        await db.query(
            `INSERT INTO peak_fetch_priority (peak_id, tier, last_viewed_at, view_count_7d, updated_at)
             VALUES ($1, 1, NOW(), 1, NOW())
             ON CONFLICT (peak_id) DO UPDATE SET
                 last_viewed_at = NOW(),
                 view_count_7d = peak_fetch_priority.view_count_7d + 1,
                 tier = CASE
                     WHEN peak_fetch_priority.view_count_7d + 1 >= 3 THEN 1
                     ELSE LEAST(peak_fetch_priority.tier, 2)
                 END,
                 updated_at = NOW()`,
            [peakId]
        );
    } catch (error) {
        console.error(`Error recording peak view for ${peakId}:`, error);
    }
};

export default recordPeakView;
