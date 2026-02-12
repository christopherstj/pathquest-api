import getCloudSqlConnection from "../getCloudSqlConnection";

interface NearbyPeak {
    id: string;
    name: string;
    distanceM: number;
}

const getAvalancheZoneDetail = async (centerId: string, zoneId: string) => {
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
    const peaksResult = await db.query(
        `SELECT p.id, p.name, pds.distance_m
         FROM peak_data_sources pds
         JOIN peaks p ON p.id = pds.peak_id
         WHERE pds.source_type = 'avalanche_zone' AND pds.source_id = $1
         ORDER BY pds.distance_m LIMIT 10`,
        [sourceId]
    );

    const nearbyPeaks: NearbyPeak[] = peaksResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        distanceM: r.distance_m,
    }));

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
    };
};

export default getAvalancheZoneDetail;
