import getCloudSqlConnection from "../getCloudSqlConnection";

interface NearbyPeak {
    id: string;
    name: string;
    distanceM: number;
}

async function getNearbyPeaks(stationId: string, sourceType: string): Promise<NearbyPeak[]> {
    const db = await getCloudSqlConnection();
    const result = await db.query(
        `SELECT p.id, p.name, pds.distance_m
         FROM peak_data_sources pds
         JOIN peaks p ON p.id = pds.peak_id
         WHERE pds.source_type = $1 AND pds.source_id = $2
         ORDER BY pds.distance_m LIMIT 10`,
        [sourceType, stationId]
    );
    return result.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        distanceM: r.distance_m,
    }));
}

function parseHistoryRange(history?: string): string | null {
    const valid: Record<string, string> = { "30d": "30 days", "90d": "90 days", "1y": "1 year" };
    return history ? valid[history] ?? null : null;
}

const getSnotelStationDetail = async (stationId: string, history?: string) => {
    const db = await getCloudSqlConnection();

    const stationResult = await db.query(
        `SELECT ss.station_id, ss.name, ss.elevation_m,
                ST_X(ss.location::geometry) AS lng, ST_Y(ss.location::geometry) AS lat,
                so.current_data, so.snow_trend, so.fetched_at
         FROM snotel_stations ss
         LEFT JOIN snotel_observations so ON so.station_id = ss.station_id
         WHERE ss.station_id = $1`,
        [stationId]
    );

    if (stationResult.rows.length === 0) return null;
    const row = stationResult.rows[0];

    const nearbyPeaks = await getNearbyPeaks(stationId, "snotel");

    let historyData: any[] = [];
    const interval = parseHistoryRange(history);
    if (interval) {
        const histResult = await db.query(
            `SELECT date, snow_depth_in, swe_in, temp_avg_c, temp_min_c, temp_max_c, precip_accum_in
             FROM snotel_history
             WHERE station_id = $1 AND date >= CURRENT_DATE - $2::interval
             ORDER BY date`,
            [stationId, interval]
        );
        historyData = histResult.rows.map((h: any) => ({
            date: h.date,
            snowDepthIn: h.snow_depth_in,
            sweIn: h.swe_in,
            tempAvgC: h.temp_avg_c,
            tempMinC: h.temp_min_c,
            tempMaxC: h.temp_max_c,
            precipAccumIn: h.precip_accum_in,
        }));
    }

    return {
        stationId: row.station_id,
        name: row.name,
        location: [row.lng, row.lat],
        elevationM: row.elevation_m,
        current: row.current_data ?? null,
        snowTrend: row.snow_trend,
        history: historyData,
        fetchedAt: row.fetched_at,
        nearbyPeaks,
    };
};

export default getSnotelStationDetail;
