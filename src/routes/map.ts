import { FastifyInstance } from "fastify";
import getCloudSqlConnection from "../helpers/getCloudSqlConnection";

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
}
