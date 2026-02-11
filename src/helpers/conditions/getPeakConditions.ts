import getCloudSqlConnection from "../getCloudSqlConnection";

export interface PeakConditionsRow {
    peak_id: string;
    weather_forecast: any;
    recent_weather: any;
    summit_window: any;
    weather_updated_at: Date | null;
}

/**
 * Read resolved conditions for a peak from peak_conditions table.
 */
const getPeakConditions = async (
    peakId: string
): Promise<PeakConditionsRow | null> => {
    const db = await getCloudSqlConnection();
    const result = await db.query(
        `SELECT peak_id, weather_forecast, recent_weather, summit_window, weather_updated_at
         FROM peak_conditions
         WHERE peak_id = $1`,
        [peakId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0] as PeakConditionsRow;
};

export default getPeakConditions;
