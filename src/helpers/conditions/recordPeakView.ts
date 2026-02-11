import getCloudSqlConnection from "../getCloudSqlConnection";

/**
 * Record that a peak was viewed, for smart fetching priority.
 * Upserts peak_fetch_priority with updated view time and count.
 * Decays view_count_7d if the last view was more than 7 days ago,
 * resetting the rolling window so peaks don't permanently stay at tier 1.
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
                 view_count_7d = CASE
                     WHEN peak_fetch_priority.last_viewed_at < NOW() - INTERVAL '7 days' THEN 1
                     ELSE peak_fetch_priority.view_count_7d + 1
                 END,
                 tier = CASE
                     WHEN peak_fetch_priority.last_viewed_at < NOW() - INTERVAL '7 days' THEN 2
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
