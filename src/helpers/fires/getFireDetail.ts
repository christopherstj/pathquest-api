import getCloudSqlConnection from "../getCloudSqlConnection";

const getFireDetail = async (incidentId: string) => {
    const db = await getCloudSqlConnection();

    const result = await db.query(
        `SELECT incident_id, name, acres, percent_contained, state, incident_type,
                discovered_at, fetched_at,
                ST_Y(centroid::geometry) AS lat, ST_X(centroid::geometry) AS lng,
                ST_AsGeoJSON(perimeter) AS geometry
         FROM active_fires
         WHERE incident_id = $1`,
        [incidentId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    const lng = row.lng != null ? parseFloat(row.lng) : null;
    const lat = row.lat != null ? parseFloat(row.lat) : null;
    const hasCentroid = lng != null && lat != null && !isNaN(lng) && !isNaN(lat);

    // Run independent queries in parallel
    const [peaksResult, landsResult] = await Promise.all([
        hasCentroid
            ? db.query(
                  `SELECT p.id, p.name,
                          ST_Distance(p.location_coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km
                   FROM peaks p
                   WHERE ST_DWithin(p.location_coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 100000)
                   ORDER BY distance_km
                   LIMIT 10`,
                  [lng, lat]
              )
            : Promise.resolve({ rows: [] }),
        db.query(
            `SELECT pl.objectid, pl.unit_nm AS name, pl.des_tp AS designation_type,
                    pl.mang_name AS manager, pl.gis_acres AS acres
             FROM public_lands pl
             JOIN active_fires af ON ST_Intersects(af.perimeter, pl.geom)
             WHERE af.incident_id = $1
             ORDER BY pl.gis_acres DESC
             LIMIT 20`,
            [incidentId]
        ),
    ]);

    return {
        incidentId: row.incident_id,
        name: row.name,
        acres: row.acres,
        percentContained: row.percent_contained,
        state: row.state,
        incidentType: row.incident_type,
        discoveredAt: row.discovered_at,
        fetchedAt: row.fetched_at,
        centroid: hasCentroid ? [lng, lat] : null,
        geometry: row.geometry ? JSON.parse(row.geometry) : null,
        nearbyPeaks: peaksResult.rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            distanceKm: Math.round(parseFloat(r.distance_km) * 10) / 10,
        })),
        affectedPublicLands: landsResult.rows.map((r: any) => ({
            objectId: String(r.objectid),
            name: r.name,
            designationType: r.designation_type,
            manager: r.manager,
            acres: r.acres,
        })),
    };
};

export default getFireDetail;
