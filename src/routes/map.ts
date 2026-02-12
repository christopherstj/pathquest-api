import { FastifyInstance } from "fastify";
import getCloudSqlConnection from "../helpers/getCloudSqlConnection";
import aggregateAreaConditions from "../helpers/conditions/aggregateAreaConditions";

export default async function (fastify: FastifyInstance) {
    // GET /api/map/fires?bbox=minLon,minLat,maxLon,maxLat
    fastify.get<{ Querystring: { bbox: string } }>(
        "/fires",
        async (request, reply) => {
            const bbox = request.query.bbox;
            if (!bbox) {
                reply.code(400).send({
                    message:
                        "bbox query parameter required (minLon,minLat,maxLon,maxLat)",
                });
                return;
            }

            const [minLon, minLat, maxLon, maxLat] = bbox
                .split(",")
                .map(Number);
            if ([minLon, minLat, maxLon, maxLat].some(isNaN)) {
                reply.code(400).send({ message: "Invalid bbox format" });
                return;
            }

            const db = await getCloudSqlConnection();
            const result = await db.query(
                `SELECT incident_id, name, acres, percent_contained, state,
                        ST_AsGeoJSON(perimeter) AS geometry
                 FROM active_fires
                 WHERE perimeter IS NOT NULL
                   AND ST_Intersects(perimeter, ST_MakeEnvelope($1,$2,$3,$4,4326))`,
                [minLon, minLat, maxLon, maxLat]
            );

            const features = result.rows.map((row: any) => ({
                type: "Feature",
                geometry: JSON.parse(row.geometry),
                properties: {
                    incident_id: row.incident_id,
                    name: row.name,
                    acres: row.acres,
                    percent_contained: row.percent_contained,
                    state: row.state,
                },
            }));

            reply.code(200).send({
                type: "FeatureCollection",
                features,
            });
        }
    );

    // GET /api/map/avalanche?bbox=minLon,minLat,maxLon,maxLat
    fastify.get<{ Querystring: { bbox: string } }>(
        "/avalanche",
        async (request, reply) => {
            const bbox = request.query.bbox;
            if (!bbox) {
                reply.code(400).send({
                    message: "bbox query parameter required",
                });
                return;
            }

            const [minLon, minLat, maxLon, maxLat] = bbox
                .split(",")
                .map(Number);
            if ([minLon, minLat, maxLon, maxLat].some(isNaN)) {
                reply.code(400).send({ message: "Invalid bbox format" });
                return;
            }

            const db = await getCloudSqlConnection();
            const result = await db.query(
                `SELECT az.center_id, az.zone_id, az.name, ST_AsGeoJSON(az.geometry) AS geometry,
                        af.danger, af.summary, af.published_at, af.expires_at
                 FROM avalanche_zones az
                 LEFT JOIN avalanche_forecasts af ON az.center_id = af.center_id AND az.zone_id = af.zone_id
                 WHERE ST_Intersects(az.geometry::geometry, ST_MakeEnvelope($1,$2,$3,$4,4326))`,
                [minLon, minLat, maxLon, maxLat]
            );

            const features = result.rows.map((row: any) => ({
                type: "Feature",
                geometry: JSON.parse(row.geometry),
                properties: {
                    center_id: row.center_id,
                    zone_id: row.zone_id,
                    name: row.name,
                    danger: row.danger,
                    summary: row.summary,
                    published_at: row.published_at,
                    expires_at: row.expires_at,
                },
            }));

            reply.code(200).send({
                type: "FeatureCollection",
                features,
            });
        }
    );

    // GET /api/map/snotel?bbox=minLon,minLat,maxLon,maxLat
    fastify.get<{ Querystring: { bbox: string } }>(
        "/snotel",
        async (request, reply) => {
            const bbox = request.query.bbox;
            if (!bbox) {
                reply.code(400).send({ message: "bbox query parameter required" });
                return;
            }

            const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);
            if ([minLon, minLat, maxLon, maxLat].some(isNaN)) {
                reply.code(400).send({ message: "Invalid bbox format" });
                return;
            }

            const db = await getCloudSqlConnection();
            const result = await db.query(
                `SELECT ss.station_id, ss.name, ss.elevation_m,
                        ST_AsGeoJSON(ss.location) AS geometry,
                        so.current_data, so.snow_trend, so.fetched_at
                 FROM snotel_stations ss
                 LEFT JOIN snotel_observations so ON so.station_id = ss.station_id
                 WHERE ST_Intersects(ss.location, ST_MakeEnvelope($1,$2,$3,$4,4326))`,
                [minLon, minLat, maxLon, maxLat]
            );

            const features = result.rows.map((row: any) => {
                const current = row.current_data ?? {};
                return {
                    type: "Feature",
                    geometry: JSON.parse(row.geometry),
                    properties: {
                        stationId: row.station_id,
                        name: row.name,
                        elevationM: row.elevation_m,
                        snowDepthIn: current.snowDepthIn ?? null,
                        sweIn: current.sweIn ?? null,
                        temperatureF: current.temperatureF ?? null,
                        snowDepthChange24hIn: current.snowDepthChange24hIn ?? null,
                        snowTrend: row.snow_trend,
                        fetchedAt: row.fetched_at,
                    },
                };
            });

            reply.code(200).send({ type: "FeatureCollection", features });
        }
    );

    // GET /api/map/streamflow?bbox=minLon,minLat,maxLon,maxLat
    fastify.get<{ Querystring: { bbox: string } }>(
        "/streamflow",
        async (request, reply) => {
            const bbox = request.query.bbox;
            if (!bbox) {
                reply.code(400).send({ message: "bbox query parameter required" });
                return;
            }

            const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);
            if ([minLon, minLat, maxLon, maxLat].some(isNaN)) {
                reply.code(400).send({ message: "Invalid bbox format" });
                return;
            }

            const db = await getCloudSqlConnection();
            const result = await db.query(
                `SELECT ug.site_id, ug.name, ST_AsGeoJSON(ug.location) AS geometry,
                        so.discharge_cfs, so.gage_height_ft, so.observed_at, so.status
                 FROM usgs_gauges ug
                 LEFT JOIN streamflow_observations so ON so.site_id = ug.site_id
                 WHERE ST_Intersects(ug.location, ST_MakeEnvelope($1,$2,$3,$4,4326))`,
                [minLon, minLat, maxLon, maxLat]
            );

            const features = result.rows.map((row: any) => ({
                type: "Feature",
                geometry: JSON.parse(row.geometry),
                properties: {
                    siteId: row.site_id,
                    name: row.name,
                    dischargeCfs: row.discharge_cfs,
                    gageHeightFt: row.gage_height_ft,
                    observedAt: row.observed_at,
                    status: row.status ?? "unknown",
                },
            }));

            reply.code(200).send({ type: "FeatureCollection", features });
        }
    );

    // GET /api/map/aqi?bbox=minLon,minLat,maxLon,maxLat
    fastify.get<{ Querystring: { bbox: string } }>(
        "/aqi",
        async (request, reply) => {
            const bbox = request.query.bbox;
            if (!bbox) {
                reply.code(400).send({ message: "bbox query parameter required" });
                return;
            }

            const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);
            if ([minLon, minLat, maxLon, maxLat].some(isNaN)) {
                reply.code(400).send({ message: "Invalid bbox format" });
                return;
            }

            const db = await getCloudSqlConnection();
            const result = await db.query(
                `SELECT site_id, site_name, aqi, category, category_number,
                        dominant_pollutant, smoke_impact, observed_at,
                        ST_AsGeoJSON(location) AS geometry
                 FROM aqi_observations
                 WHERE ST_Intersects(location, ST_MakeEnvelope($1,$2,$3,$4,4326))`,
                [minLon, minLat, maxLon, maxLat]
            );

            const features = result.rows.map((row: any) => ({
                type: "Feature",
                geometry: JSON.parse(row.geometry),
                properties: {
                    siteId: row.site_id,
                    siteName: row.site_name,
                    aqi: row.aqi,
                    category: row.category,
                    categoryNumber: row.category_number,
                    dominantPollutant: row.dominant_pollutant,
                    smokeImpact: row.smoke_impact,
                    observedAt: row.observed_at,
                },
            }));

            reply.code(200).send({ type: "FeatureCollection", features });
        }
    );

    // GET /api/map/alerts?bbox=minLon,minLat,maxLon,maxLat
    fastify.get<{ Querystring: { bbox: string } }>(
        "/alerts",
        async (request, reply) => {
            const bbox = request.query.bbox;
            if (!bbox) {
                reply.code(400).send({ message: "bbox query parameter required" });
                return;
            }

            const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);
            if ([minLon, minLat, maxLon, maxLat].some(isNaN)) {
                reply.code(400).send({ message: "Invalid bbox format" });
                return;
            }

            const db = await getCloudSqlConnection();
            const result = await db.query(
                `SELECT nz.zone_id, nz.name, nz.state, ST_AsGeoJSON(nz.geometry) AS geometry,
                        json_agg(json_build_object(
                            'alertId', naa.alert_id,
                            'event', naa.event,
                            'severity', naa.severity,
                            'headline', naa.headline,
                            'onset', naa.onset,
                            'expires', naa.expires
                        )) AS alerts
                 FROM nws_zones nz
                 JOIN nws_active_alerts naa ON nz.zone_id = ANY(naa.affected_zones)
                   AND (naa.expires IS NULL OR naa.expires > NOW())
                 WHERE ST_Intersects(nz.geometry::geometry, ST_MakeEnvelope($1,$2,$3,$4,4326))
                 GROUP BY nz.zone_id, nz.name, nz.state, nz.geometry`,
                [minLon, minLat, maxLon, maxLat]
            );

            const features = result.rows.map((row: any) => ({
                type: "Feature",
                geometry: JSON.parse(row.geometry),
                properties: {
                    zoneId: row.zone_id,
                    zoneName: row.name,
                    state: row.state,
                    alerts: row.alerts,
                },
            }));

            reply.code(200).send({ type: "FeatureCollection", features });
        }
    );

    // GET /api/map/public-lands/:objectId/conditions
    fastify.get<{
        Params: { objectId: string };
    }>(
        "/public-lands/:objectId/conditions",
        async (request, reply) => {
            const objectId = request.params.objectId;

            const db = await getCloudSqlConnection();

            // Get public land info
            const landResult = await db.query(
                `SELECT objectid, unit_nm, des_tp FROM public_lands WHERE objectid = $1`,
                [objectId]
            );

            if (landResult.rows.length === 0) {
                reply.code(404).send({ message: "Public land not found" });
                return;
            }

            const land = landResult.rows[0];

            // Get peak IDs in this public land
            const peaksResult = await db.query(
                `SELECT peak_id FROM peaks_public_lands WHERE public_land_id = $1`,
                [objectId]
            );

            const peakIds = peaksResult.rows.map((r: any) => r.peak_id);
            const summary = await aggregateAreaConditions(peakIds);

            reply.code(200).send({
                publicLandId: land.objectid,
                publicLandName: land.unit_nm,
                designationType: land.des_tp,
                ...summary,
            });
        }
    );
}
