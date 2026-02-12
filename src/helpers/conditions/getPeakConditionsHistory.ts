import getCloudSqlConnection from "../getCloudSqlConnection";

type HistoryRange = "30d" | "90d" | "1y";

const rangeToInterval: Record<HistoryRange, string> = {
    "30d": "30 days",
    "90d": "90 days",
    "1y": "1 year",
};

const getPeakConditionsHistory = async (
    peakId: string,
    range: HistoryRange,
    sources: string[]
) => {
    const db = await getCloudSqlConnection();
    const interval = rangeToInterval[range];

    // Find mapped sources for this peak
    const mappingResult = await db.query(
        `SELECT source_type, source_id
         FROM peak_data_sources
         WHERE peak_id = $1 AND source_type = ANY($2::text[])`,
        [
            peakId,
            sources.map((s) => {
                if (s === "snotel") return "snotel";
                if (s === "streamflow") return "usgs_gauge";
                if (s === "aqi") return "aqi";
                return s;
            }),
        ]
    );

    const snotelIds: string[] = [];
    const streamflowIds: string[] = [];
    for (const row of mappingResult.rows) {
        if (row.source_type === "snotel") snotelIds.push(row.source_id);
        if (row.source_type === "usgs_gauge") streamflowIds.push(row.source_id);
    }

    // For AQI, find nearest site via proximity
    const wantsAqi = sources.includes("aqi");

    const [snotelHistory, streamflowHistory, aqiHistory] = await Promise.all([
        sources.includes("snotel") && snotelIds.length > 0
            ? db.query(
                  `SELECT sh.station_id, ss.name AS station_name,
                          sh.date, sh.snow_depth_in, sh.swe_in,
                          sh.temp_avg_c, sh.temp_min_c, sh.temp_max_c, sh.precip_accum_in
                   FROM snotel_history sh
                   JOIN snotel_stations ss ON ss.station_id = sh.station_id
                   WHERE sh.station_id = ANY($1::text[]) AND sh.date >= CURRENT_DATE - $2::interval
                   ORDER BY sh.station_id, sh.date`,
                  [snotelIds, interval]
              )
            : Promise.resolve({ rows: [] }),
        sources.includes("streamflow") && streamflowIds.length > 0
            ? db.query(
                  `SELECT sfh.site_id, ug.name AS site_name,
                          sfh.date, sfh.discharge_cfs, sfh.gage_height_ft
                   FROM streamflow_history sfh
                   JOIN usgs_gauges ug ON ug.site_id = sfh.site_id
                   WHERE sfh.site_id = ANY($1::text[]) AND sfh.date >= CURRENT_DATE - $2::interval
                   ORDER BY sfh.site_id, sfh.date`,
                  [streamflowIds, interval]
              )
            : Promise.resolve({ rows: [] }),
        wantsAqi
            ? db.query(
                  `SELECT ah.site_id, ao.site_name,
                          ah.date, ah.aqi, ah.pm25_aqi, ah.ozone_aqi, ah.category
                   FROM aqi_history ah
                   JOIN aqi_observations ao ON ao.site_id = ah.site_id
                   WHERE ah.site_id IN (
                       SELECT ao2.site_id FROM aqi_observations ao2, peaks p
                       WHERE p.id = $1 AND ST_DWithin(ao2.location, p.location_coords, 80000)
                       ORDER BY ST_Distance(ao2.location, p.location_coords) LIMIT 3
                   ) AND ah.date >= CURRENT_DATE - $2::interval
                   ORDER BY ah.site_id, ah.date`,
                  [peakId, interval]
              )
            : Promise.resolve({ rows: [] }),
    ]);

    // Group snotel by station
    const snotelGrouped: Record<string, { stationId: string; stationName: string; history: any[] }> = {};
    for (const row of snotelHistory.rows) {
        if (!snotelGrouped[row.station_id]) {
            snotelGrouped[row.station_id] = {
                stationId: row.station_id,
                stationName: row.station_name,
                history: [],
            };
        }
        snotelGrouped[row.station_id].history.push({
            date: row.date,
            snowDepthIn: row.snow_depth_in,
            sweIn: row.swe_in,
            tempAvgC: row.temp_avg_c,
            tempMinC: row.temp_min_c,
            tempMaxC: row.temp_max_c,
            precipAccumIn: row.precip_accum_in,
        });
    }

    // Group streamflow by site
    const streamGrouped: Record<string, { siteId: string; siteName: string; history: any[] }> = {};
    for (const row of streamflowHistory.rows) {
        if (!streamGrouped[row.site_id]) {
            streamGrouped[row.site_id] = {
                siteId: row.site_id,
                siteName: row.site_name,
                history: [],
            };
        }
        streamGrouped[row.site_id].history.push({
            date: row.date,
            dischargeCfs: row.discharge_cfs,
            gageHeightFt: row.gage_height_ft,
        });
    }

    // Group AQI by site
    const aqiGrouped: Record<string, { siteId: string; siteName: string; history: any[] }> = {};
    for (const row of aqiHistory.rows) {
        if (!aqiGrouped[row.site_id]) {
            aqiGrouped[row.site_id] = {
                siteId: row.site_id,
                siteName: row.site_name,
                history: [],
            };
        }
        aqiGrouped[row.site_id].history.push({
            date: row.date,
            aqi: row.aqi,
            pm25Aqi: row.pm25_aqi,
            ozoneAqi: row.ozone_aqi,
            category: row.category,
        });
    }

    return {
        peakId,
        range,
        snotel: sources.includes("snotel") ? Object.values(snotelGrouped) : null,
        streamFlow: sources.includes("streamflow") ? Object.values(streamGrouped) : null,
        airQuality: sources.includes("aqi") ? Object.values(aqiGrouped) : null,
    };
};

export default getPeakConditionsHistory;
