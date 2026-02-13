import { Pool } from "pg";
import getCloudSqlConnection from "../getCloudSqlConnection";
import getSnowPoint, { SnowPointResult } from "../snow/getSnowPoint";

interface ResolvedSourceConditions {
    avalanche: any | null;
    snotel: any | null;
    nwsAlerts: any | null;
    streamFlow: any | null;
    airQuality: any | null;
    fireProximity: any | null;
    snowPoint: SnowPointResult | null;
}

async function resolveAvalanche(db: Pool, peakId: string) {
    const result = await db.query(
        `SELECT af.danger, af.problems, af.summary, af.forecast_url, af.published_at, af.expires_at,
                af.zone_id, af.zone_name, af.center_id, af.center_name
         FROM peak_data_sources pds
         JOIN avalanche_forecasts af ON af.center_id = split_part(pds.source_id, ':', 1)
           AND af.zone_id = split_part(pds.source_id, ':', 2)
         WHERE pds.peak_id = $1 AND pds.source_type = 'avalanche_zone'
         ORDER BY pds.distance_m NULLS LAST LIMIT 1`,
        [peakId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        danger: row.danger,
        problems: row.problems,
        summary: row.summary,
        forecastUrl: row.forecast_url,
        publishedAt: row.published_at,
        expiresAt: row.expires_at,
        zoneId: row.zone_id,
        zoneName: row.zone_name,
        centerId: row.center_id,
        centerName: row.center_name,
    };
}

async function resolveSnotel(db: Pool, peakId: string) {
    const result = await db.query(
        `SELECT so.station_id, so.current_data, so.history_7d, so.snow_trend,
                ss.name, ss.elevation_m, pds.distance_m
         FROM peak_data_sources pds
         JOIN snotel_observations so ON so.station_id = pds.source_id
         JOIN snotel_stations ss ON ss.station_id = pds.source_id
         WHERE pds.peak_id = $1 AND pds.source_type = 'snotel'
         ORDER BY pds.distance_m LIMIT 3`,
        [peakId]
    );

    if (result.rows.length === 0) return null;

    const stations = result.rows.map((row: any) => ({
        stationId: row.station_id,
        name: row.name,
        distanceM: row.distance_m,
        elevationM: row.elevation_m,
        current: row.current_data,
        history7d: row.history_7d,
    }));

    return {
        stations,
        nearestStation: stations[0].stationId,
        snowTrend: result.rows[0].snow_trend,
    };
}

async function resolveAlerts(db: Pool, peakId: string) {
    const result = await db.query(
        `SELECT naa.alert_id, naa.event, naa.severity, naa.urgency, naa.certainty,
                naa.headline, naa.description, naa.instruction, naa.onset, naa.expires, naa.affected_zones
         FROM nws_active_alerts naa
         WHERE naa.affected_zones && (
           SELECT COALESCE(array_agg(source_id), '{}')
           FROM peak_data_sources
           WHERE peak_id = $1 AND source_type = 'nws_zone'
         ) AND (naa.expires IS NULL OR naa.expires > NOW())`,
        [peakId]
    );

    if (result.rows.length === 0) return null;

    const alerts = result.rows.map((row: any) => ({
        id: row.alert_id,
        event: row.event,
        severity: row.severity,
        urgency: row.urgency,
        certainty: row.certainty,
        headline: row.headline,
        description: row.description,
        instruction: row.instruction,
        onset: row.onset,
        expires: row.expires,
        zones: row.affected_zones,
    }));

    const severityOrder: Record<string, number> = {
        Extreme: 4,
        Severe: 3,
        Moderate: 2,
        Minor: 1,
        Unknown: 0,
    };

    const maxSeverity = alerts.reduce(
        (max: string, a: any) =>
            (severityOrder[a.severity] ?? 0) > (severityOrder[max] ?? 0)
                ? a.severity
                : max,
        alerts[0].severity
    );

    return {
        alerts,
        activeCount: alerts.length,
        maxSeverity,
    };
}

async function resolveStreamflow(db: Pool, peakId: string) {
    const result = await db.query(
        `SELECT so.site_id, so.discharge_cfs, so.gage_height_ft, so.observed_at,
                ug.name AS site_name, pds.distance_m
         FROM peak_data_sources pds
         JOIN streamflow_observations so ON so.site_id = pds.source_id
         JOIN usgs_gauges ug ON ug.site_id = pds.source_id
         WHERE pds.peak_id = $1 AND pds.source_type = 'usgs_gauge'
         ORDER BY pds.distance_m LIMIT 3`,
        [peakId]
    );

    if (result.rows.length === 0) return null;

    const gauges = result.rows.map((row: any) => ({
        siteId: row.site_id,
        siteName: row.site_name,
        distanceM: row.distance_m,
        current: {
            dischargeCfs: row.discharge_cfs,
            gageHeightFt: row.gage_height_ft,
            dateTime: row.observed_at,
        },
        percentile: null,
        status: "unknown",
    }));

    return {
        gauges,
        nearestGauge: gauges[0].siteId,
        crossingAlert: false,
    };
}

async function resolveAqi(db: Pool, peakId: string) {
    const result = await db.query(
        `SELECT ao.site_id, ao.site_name, ao.aqi, ao.pm25_aqi, ao.ozone_aqi,
                ao.dominant_pollutant, ao.category, ao.category_number,
                ao.reporting_area, ao.smoke_impact, ao.observed_at,
                ST_Distance(ao.location, p.location_coords) AS distance_m
         FROM aqi_observations ao, peaks p
         WHERE p.id = $1 AND ST_DWithin(ao.location, p.location_coords, 80000)
         ORDER BY ST_Distance(ao.location, p.location_coords) LIMIT 1`,
        [peakId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        current: {
            aqi: row.aqi,
            category: row.category,
            categoryNumber: row.category_number,
            pm25: row.pm25_aqi,
            ozone: row.ozone_aqi,
            dominantPollutant: row.dominant_pollutant,
            reportingArea: row.reporting_area,
            dateObserved: row.observed_at,
        },
        forecast: [],
        smokeImpact: row.smoke_impact,
    };
}

function computeBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): string {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let bearing = toDeg(Math.atan2(y, x));
    bearing = ((bearing % 360) + 360) % 360;

    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(bearing / 45) % 8];
}

async function resolveFires(db: Pool, peakId: string) {
    const result = await db.query(
        `SELECT af.incident_id, af.name, af.acres, af.percent_contained, af.state,
                ST_Distance(af.centroid, p.location_coords) AS distance_m,
                ST_Y(af.centroid::geometry) AS fire_lat, ST_X(af.centroid::geometry) AS fire_lon,
                ST_Y(p.location_coords::geometry) AS peak_lat, ST_X(p.location_coords::geometry) AS peak_lon
         FROM active_fires af, peaks p
         WHERE p.id = $1 AND ST_DWithin(af.centroid, p.location_coords, 100000)
         ORDER BY distance_m`,
        [peakId]
    );

    if (result.rows.length === 0) return null;

    const nearbyFires = result.rows.map((row: any) => {
        const distanceKm = parseFloat(row.distance_m) / 1000;
        const direction = computeBearing(
            parseFloat(row.peak_lat),
            parseFloat(row.peak_lon),
            parseFloat(row.fire_lat),
            parseFloat(row.fire_lon)
        );
        return {
            incidentId: row.incident_id,
            name: row.name,
            acres: row.acres,
            percentContained: row.percent_contained,
            state: row.state,
            distanceKm: Math.round(distanceKm * 10) / 10,
            direction,
            centroidLat: parseFloat(row.fire_lat),
            centroidLon: parseFloat(row.fire_lon),
        };
    });

    const closestFireKm = nearbyFires[0].distanceKm;
    const activeFiresWithin50km = nearbyFires.filter(
        (f) => f.distanceKm <= 50 && (f.percentContained ?? 0) < 100
    ).length;

    let smokeRisk: string;
    if (closestFireKm < 20 && (nearbyFires[0].percentContained ?? 0) < 100) {
        smokeRisk = "active";
    } else if (closestFireKm < 50) {
        smokeRisk = "likely";
    } else if (closestFireKm < 100) {
        smokeRisk = "possible";
    } else {
        smokeRisk = "none";
    }

    return {
        nearbyFires,
        closestFireKm,
        activeFiresWithin50km,
        smokeRisk,
    };
}

async function resolveSnowPoint(db: Pool, peakId: string): Promise<SnowPointResult | null> {
    try {
        const result = await db.query(
            `SELECT ST_Y(location_coords::geometry) AS lat, ST_X(location_coords::geometry) AS lng
             FROM peaks WHERE id = $1 AND location_coords IS NOT NULL`,
            [peakId]
        );
        if (result.rows.length === 0) return null;

        const { lat, lng } = result.rows[0];
        return await getSnowPoint(parseFloat(lat), parseFloat(lng));
    } catch {
        return null;
    }
}

const resolveSourceConditions = async (
    peakId: string
): Promise<ResolvedSourceConditions> => {
    const db = await getCloudSqlConnection();

    const [avalanche, snotel, alerts, streamflow, aqi, fires, snowPoint] =
        await Promise.all([
            resolveAvalanche(db, peakId),
            resolveSnotel(db, peakId),
            resolveAlerts(db, peakId),
            resolveStreamflow(db, peakId),
            resolveAqi(db, peakId),
            resolveFires(db, peakId),
            resolveSnowPoint(db, peakId),
        ]);

    return {
        avalanche,
        snotel,
        nwsAlerts: alerts,
        streamFlow: streamflow,
        airQuality: aqi,
        fireProximity: fires,
        snowPoint,
    };
};

export default resolveSourceConditions;
