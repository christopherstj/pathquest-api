import getCloudSqlConnection from "../getCloudSqlConnection";

/**
 * Read just the summit_window JSONB from peak_conditions for a peak.
 */
const getSummitWindow = async (peakId: string): Promise<any | null> => {
    const db = await getCloudSqlConnection();
    const result = await db.query(
        `SELECT summit_window FROM peak_conditions WHERE peak_id = $1`,
        [peakId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0].summit_window;
};

export default getSummitWindow;
