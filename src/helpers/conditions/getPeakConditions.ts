import getCloudSqlConnection from "../getCloudSqlConnection";

export interface PeakConditionsRow {
    peak_id: string;
    weather_forecast: any;
    recent_weather: any;
    summit_window: any;
    weather_updated_at: Date | null;
    avalanche_forecast: any;
    avalanche_updated_at: Date | null;
    snotel_data: any;
    snotel_updated_at: Date | null;
    nws_alerts: any;
    nws_alerts_updated_at: Date | null;
    stream_flow: any;
    stream_flow_updated_at: Date | null;
    trail_conditions: any;
    trail_conditions_updated_at: Date | null;
    air_quality: any;
    air_quality_updated_at: Date | null;
    fire_proximity: any;
    fire_proximity_updated_at: Date | null;
    road_access: any;
    road_access_updated_at: Date | null;
    gear_recommendations: any;
    gear_updated_at: Date | null;
}

/**
 * Read resolved conditions for a peak from peak_conditions table.
 */
const getPeakConditions = async (
    peakId: string
): Promise<PeakConditionsRow | null> => {
    const db = await getCloudSqlConnection();
    const result = await db.query(
        `SELECT peak_id, weather_forecast, recent_weather, summit_window, weather_updated_at,
                avalanche_forecast, avalanche_updated_at,
                snotel_data, snotel_updated_at,
                nws_alerts, nws_alerts_updated_at,
                stream_flow, stream_flow_updated_at,
                trail_conditions, trail_conditions_updated_at,
                air_quality, air_quality_updated_at,
                fire_proximity, fire_proximity_updated_at,
                road_access, road_access_updated_at,
                gear_recommendations, gear_updated_at
         FROM peak_conditions
         WHERE peak_id = $1`,
        [peakId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0] as PeakConditionsRow;
};

export default getPeakConditions;
