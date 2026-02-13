import getCloudSqlConnection from "../getCloudSqlConnection";

interface AreaConditionsSummary {
    peakCount: number;
    peaksWithConditions: number;
    weather: {
        tempRangeCelsius: { min: number; max: number } | null;
        worstWeatherCode: number | null;
        maxWindSpeedKmh: number | null;
        maxPrecipProbability: number | null;
    } | null;
    bestSummitWindow: {
        peakId: string;
        peakName: string;
        bestDay: string;
        bestScore: number;
    } | null;
    avalanche: {
        maxDangerLevel: number;
        zonesWithConsiderable: number;
        zones: { centerId: string; zoneId: string; zoneName: string; maxDanger: number }[];
    } | null;
    nwsAlerts: {
        totalActiveAlerts: number;
        maxSeverity: string;
        events: string[];
        alerts: { event: string; severity: string; headline: string | null }[];
    } | null;
    airQuality: {
        worstAqi: number;
        worstCategory: string;
        smokeImpact: string;
    } | null;
    fireProximity: {
        closestFireKm: number;
        totalFiresWithin50km: number;
        smokeRisk: string;
        fires: { incidentId: string; name: string; acres: number | null; percentContained: number | null; distanceKm: number }[];
    } | null;
    snotel: {
        maxSnowDepthIn: number;
        avgSnowDepthIn: number;
        snowTrend: string;
    } | null;
    streamFlow: {
        anyHighWater: boolean;
        anyCrossingAlert: boolean;
    } | null;
    updatedAt: string;
}

const severityOrder: Record<string, number> = {
    Extreme: 4,
    Severe: 3,
    Moderate: 2,
    Minor: 1,
    Unknown: 0,
};

const aggregateAreaConditions = async (peakIds: string[]): Promise<AreaConditionsSummary> => {
    if (peakIds.length === 0) {
        return {
            peakCount: 0,
            peaksWithConditions: 0,
            weather: null,
            bestSummitWindow: null,
            avalanche: null,
            nwsAlerts: null,
            airQuality: null,
            fireProximity: null,
            snotel: null,
            streamFlow: null,
            updatedAt: new Date().toISOString(),
        };
    }

    const db = await getCloudSqlConnection();

    // 1. Get cached weather conditions for all peaks
    const weatherResult = await db.query(
        `SELECT pc.peak_id, pc.weather_forecast, pc.summit_window, p.name AS peak_name
         FROM peak_conditions pc
         JOIN peaks p ON p.id = pc.peak_id
         WHERE pc.peak_id = ANY($1::text[])`,
        [peakIds]
    );

    // 2. Get unique source mappings
    const sourcesResult = await db.query(
        `SELECT DISTINCT source_type, source_id
         FROM peak_data_sources
         WHERE peak_id = ANY($1::text[])`,
        [peakIds]
    );

    const sourcesByType: Record<string, string[]> = {};
    for (const row of sourcesResult.rows) {
        if (!sourcesByType[row.source_type]) sourcesByType[row.source_type] = [];
        sourcesByType[row.source_type].push(row.source_id);
    }

    // 3. Parallel queries for each source type
    const [avyResult, snotelResult, alertsResult, aqiResult, firesResult, streamResult] =
        await Promise.all([
            sourcesByType["avalanche_zone"]?.length
                ? db.query(
                      `SELECT center_id, zone_id, zone_name, danger
                       FROM avalanche_forecasts
                       WHERE (center_id || ':' || zone_id) = ANY($1::text[])`,
                      [sourcesByType["avalanche_zone"]]
                  )
                : Promise.resolve({ rows: [] }),
            sourcesByType["snotel"]?.length
                ? db.query(
                      `SELECT so.station_id, so.current_data, so.snow_trend
                       FROM snotel_observations so
                       WHERE so.station_id = ANY($1::text[])`,
                      [sourcesByType["snotel"]]
                  )
                : Promise.resolve({ rows: [] }),
            sourcesByType["nws_zone"]?.length
                ? db.query(
                      `SELECT alert_id, event, severity, headline
                       FROM nws_active_alerts
                       WHERE affected_zones && $1::text[]
                         AND (expires IS NULL OR expires > NOW())`,
                      [sourcesByType["nws_zone"]]
                  )
                : Promise.resolve({ rows: [] }),
            db.query(
                `SELECT ao.aqi, ao.category, ao.category_number, ao.smoke_impact
                 FROM aqi_observations ao, peaks p
                 WHERE p.id = ANY($1::text[])
                   AND ST_DWithin(ao.location, p.location_coords, 80000)
                 ORDER BY ao.aqi DESC LIMIT 1`,
                [peakIds]
            ),
            db.query(
                `SELECT af.incident_id, af.name, af.acres, af.percent_contained,
                        MIN(ST_Distance(af.centroid, p.location_coords)) AS min_distance_m
                 FROM active_fires af, peaks p
                 WHERE p.id = ANY($1::text[])
                   AND ST_DWithin(af.centroid, p.location_coords, 100000)
                 GROUP BY af.incident_id, af.name, af.acres, af.percent_contained
                 ORDER BY min_distance_m`,
                [peakIds]
            ),
            sourcesByType["usgs_gauge"]?.length
                ? db.query(
                      `SELECT so.status
                       FROM streamflow_observations so
                       WHERE so.site_id = ANY($1::text[])`,
                      [sourcesByType["usgs_gauge"]]
                  )
                : Promise.resolve({ rows: [] }),
        ]);

    // Aggregate weather
    let weatherSummary: AreaConditionsSummary["weather"] = null;
    const peaksWithConditions = weatherResult.rows.length;

    if (weatherResult.rows.length > 0) {
        let minTemp = Infinity;
        let maxTemp = -Infinity;
        let worstCode: number | null = null;
        let maxWind: number | null = null;
        let maxPrecipProb: number | null = null;

        for (const row of weatherResult.rows) {
            const forecast = row.weather_forecast;
            if (!forecast?.daily) continue;

            for (const day of forecast.daily) {
                if (day.tempLow != null && day.tempLow < minTemp) minTemp = day.tempLow;
                if (day.tempHigh != null && day.tempHigh > maxTemp) maxTemp = day.tempHigh;
                if (day.weatherCode != null && (worstCode === null || day.weatherCode > worstCode))
                    worstCode = day.weatherCode;
                if (day.windSpeed != null && (maxWind === null || day.windSpeed > maxWind))
                    maxWind = day.windSpeed;
                if (day.precipProbability != null && (maxPrecipProb === null || day.precipProbability > maxPrecipProb))
                    maxPrecipProb = day.precipProbability;
            }
        }

        weatherSummary = {
            tempRangeCelsius:
                minTemp !== Infinity && maxTemp !== -Infinity
                    ? { min: minTemp, max: maxTemp }
                    : null,
            worstWeatherCode: worstCode,
            maxWindSpeedKmh: maxWind,
            maxPrecipProbability: maxPrecipProb,
        };
    }

    // Best summit window across all peaks
    let bestSummitWindow: AreaConditionsSummary["bestSummitWindow"] = null;
    for (const row of weatherResult.rows) {
        const sw = row.summit_window;
        if (!sw?.bestScore) continue;
        if (!bestSummitWindow || sw.bestScore > bestSummitWindow.bestScore) {
            bestSummitWindow = {
                peakId: row.peak_id,
                peakName: row.peak_name,
                bestDay: sw.bestDay,
                bestScore: sw.bestScore,
            };
        }
    }

    // Aggregate avalanche
    let avySummary: AreaConditionsSummary["avalanche"] = null;
    if (avyResult.rows.length > 0) {
        let maxDanger = 0;
        let zonesWithConsiderable = 0;
        const zones: { centerId: string; zoneId: string; zoneName: string; maxDanger: number }[] = [];

        for (const row of avyResult.rows) {
            let zoneDanger = 0;
            if (Array.isArray(row.danger)) {
                for (const d of row.danger) {
                    const levels = [d.upper, d.middle, d.lower].filter((l) => typeof l === "number");
                    const zMax = levels.length > 0 ? Math.max(...levels) : 0;
                    if (zMax > zoneDanger) zoneDanger = zMax;
                }
            }
            if (zoneDanger > maxDanger) maxDanger = zoneDanger;
            if (zoneDanger >= 3) zonesWithConsiderable++;
            zones.push({
                centerId: row.center_id,
                zoneId: row.zone_id,
                zoneName: row.zone_name,
                maxDanger: zoneDanger,
            });
        }

        avySummary = { maxDangerLevel: maxDanger, zonesWithConsiderable, zones };
    }

    // Aggregate alerts
    let alertsSummary: AreaConditionsSummary["nwsAlerts"] = null;
    if (alertsResult.rows.length > 0) {
        const events = [...new Set(alertsResult.rows.map((r: any) => r.event))];
        const maxSev = alertsResult.rows.reduce(
            (max: string, r: any) =>
                (severityOrder[r.severity] ?? 0) > (severityOrder[max] ?? 0) ? r.severity : max,
            alertsResult.rows[0].severity
        );
        alertsSummary = {
            totalActiveAlerts: alertsResult.rows.length,
            maxSeverity: maxSev,
            events,
            alerts: alertsResult.rows.map((r: any) => ({
                event: r.event,
                severity: r.severity,
                headline: r.headline ?? null,
            })),
        };
    }

    // Aggregate AQI
    let aqiSummary: AreaConditionsSummary["airQuality"] = null;
    if (aqiResult.rows.length > 0) {
        const row = aqiResult.rows[0];
        aqiSummary = {
            worstAqi: row.aqi,
            worstCategory: row.category,
            smokeImpact: row.smoke_impact ?? "none",
        };
    }

    // Aggregate fires
    let fireSummary: AreaConditionsSummary["fireProximity"] = null;
    if (firesResult.rows.length > 0) {
        const closestKm = parseFloat(firesResult.rows[0].min_distance_m) / 1000;
        const within50km = firesResult.rows.filter(
            (r: any) => parseFloat(r.min_distance_m) / 1000 <= 50 && (r.percent_contained ?? 0) < 100
        ).length;

        let smokeRisk: string;
        if (closestKm < 20) smokeRisk = "active";
        else if (closestKm < 50) smokeRisk = "likely";
        else if (closestKm < 100) smokeRisk = "possible";
        else smokeRisk = "none";

        fireSummary = {
            closestFireKm: Math.round(closestKm * 10) / 10,
            totalFiresWithin50km: within50km,
            smokeRisk,
            fires: firesResult.rows.map((r: any) => ({
                incidentId: r.incident_id,
                name: r.name,
                acres: r.acres != null ? parseFloat(r.acres) : null,
                percentContained: r.percent_contained != null ? parseFloat(r.percent_contained) : null,
                distanceKm: Math.round(parseFloat(r.min_distance_m) / 100) / 10,
            })),
        };
    }

    // Aggregate SNOTEL
    let snotelSummary: AreaConditionsSummary["snotel"] = null;
    if (snotelResult.rows.length > 0) {
        let maxDepth = 0;
        let totalDepth = 0;
        let depthCount = 0;
        const trends: string[] = [];

        for (const row of snotelResult.rows) {
            const current = row.current_data;
            if (current?.snowDepthIn != null) {
                if (current.snowDepthIn > maxDepth) maxDepth = current.snowDepthIn;
                totalDepth += current.snowDepthIn;
                depthCount++;
            }
            if (row.snow_trend) trends.push(row.snow_trend);
        }

        const trendCounts: Record<string, number> = {};
        for (const t of trends) trendCounts[t] = (trendCounts[t] || 0) + 1;
        const dominantTrend = Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

        snotelSummary = {
            maxSnowDepthIn: maxDepth,
            avgSnowDepthIn: depthCount > 0 ? Math.round((totalDepth / depthCount) * 10) / 10 : 0,
            snowTrend: dominantTrend,
        };
    }

    // Aggregate streamflow
    let streamSummary: AreaConditionsSummary["streamFlow"] = null;
    if (streamResult.rows.length > 0) {
        const statuses = streamResult.rows.map((r: any) => r.status);
        streamSummary = {
            anyHighWater: statuses.some((s: string) => s === "high" || s === "flood"),
            anyCrossingAlert: false,
        };
    }

    return {
        peakCount: peakIds.length,
        peaksWithConditions,
        weather: weatherSummary,
        bestSummitWindow,
        avalanche: avySummary,
        nwsAlerts: alertsSummary,
        airQuality: aqiSummary,
        fireProximity: fireSummary,
        snotel: snotelSummary,
        streamFlow: streamSummary,
        updatedAt: new Date().toISOString(),
    };
};

export default aggregateAreaConditions;
