import getCloudSqlConnection from "../getCloudSqlConnection";

interface NearbyPeak {
    id: string;
    name: string;
    elevation: number | null;
    state: string | null;
    distanceM: number;
    public_summits: number;
    summits: number;
}

const getAvalancheZoneDetail = async (centerId: string, zoneId: string, userId?: string) => {
    const db = await getCloudSqlConnection();

    const result = await db.query(
        `SELECT af.center_id, af.zone_id, af.zone_name, af.center_name,
                af.danger, af.problems, af.summary, af.forecast_url,
                af.published_at, af.expires_at
         FROM avalanche_forecasts af
         WHERE af.center_id = $1 AND af.zone_id = $2`,
        [centerId, zoneId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    const sourceId = `${centerId}:${zoneId}`;
    const peakParams: any[] = [sourceId];
    const userIdParam = userId ? `$${peakParams.push(userId)}` : null;

    // Run independent queries in parallel
    const [zoneResult, peaksResult] = await Promise.all([
        db.query(
            `SELECT ST_AsGeoJSON(geometry) AS geometry,
                    ST_Y(ST_Centroid(geometry::geometry)) AS lat,
                    ST_X(ST_Centroid(geometry::geometry)) AS lng
             FROM avalanche_zones
             WHERE center_id = $1 AND zone_id = $2`,
            [centerId, zoneId]
        ),
        db.query(
        `SELECT p.id, p.name, p.elevation, p.state, pds.distance_m,
                COALESCE((
                    SELECT COUNT(DISTINCT sub.id) FROM (
                        SELECT ap.id FROM activities_peaks ap
                        INNER JOIN activities a ON a.id = ap.activity_id
                        INNER JOIN users u ON u.id = a.user_id
                        WHERE ap.peak_id = p.id AND ap.is_public = true AND u.is_public = true
                        AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                        UNION
                        SELECT upm.id FROM user_peak_manual upm
                        INNER JOIN users u ON u.id = upm.user_id
                        WHERE upm.peak_id = p.id AND upm.is_public = true AND u.is_public = true
                    ) sub
                ), 0)::int AS public_summits
                ${userIdParam ? `,
                COALESCE((
                    SELECT COUNT(*) FROM (
                        SELECT ap.id FROM activities_peaks ap
                        INNER JOIN activities a ON a.id = ap.activity_id
                        WHERE ap.peak_id = p.id AND a.user_id = ${userIdParam}
                        AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                        UNION ALL
                        SELECT upm.id FROM user_peak_manual upm
                        WHERE upm.peak_id = p.id AND upm.user_id = ${userIdParam}
                    ) s
                ), 0)::int AS summits` : ""}
         FROM peak_data_sources pds
         JOIN peaks p ON p.id = pds.peak_id
         WHERE pds.source_type = 'avalanche_zone' AND pds.source_id = $1
         ORDER BY pds.distance_m LIMIT 10`,
            peakParams
        ),
    ]);

    const zone = zoneResult.rows[0] ?? null;
    const nearbyPeaks: NearbyPeak[] = peaksResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        elevation: r.elevation,
        state: r.state,
        distanceM: r.distance_m,
        public_summits: r.public_summits ?? 0,
        summits: r.summits ?? 0,
    }));

    // Find public lands that intersect the avalanche zone
    const landsResult = zone ? await db.query(
        `SELECT pl.objectid, pl.unit_nm AS name, pl.des_tp AS designation_type,
                pl.mang_name AS manager, pl.gis_acres AS acres
         FROM public_lands pl
         JOIN avalanche_zones az ON ST_Intersects(az.geometry::geometry, pl.geom)
         WHERE az.center_id = $1 AND az.zone_id = $2
         ORDER BY pl.gis_acres DESC
         LIMIT 20`,
        [centerId, zoneId]
    ) : { rows: [] };

    return {
        centerId: row.center_id,
        zoneId: row.zone_id,
        zoneName: row.zone_name,
        centerName: row.center_name,
        danger: row.danger,
        problems: row.problems,
        summary: row.summary,
        forecastUrl: row.forecast_url,
        publishedAt: row.published_at,
        expiresAt: row.expires_at,
        nearbyPeaks,
        geometry: zone?.geometry ? JSON.parse(zone.geometry) : null,
        centroid: zone?.lng != null && zone?.lat != null
            ? [parseFloat(zone.lng), parseFloat(zone.lat)]
            : null,
        affectedPublicLands: landsResult.rows.map((r: any) => ({
            objectId: String(r.objectid),
            name: r.name,
            designationType: r.designation_type,
            manager: r.manager,
            acres: r.acres,
        })),
    };
};

export default getAvalancheZoneDetail;
