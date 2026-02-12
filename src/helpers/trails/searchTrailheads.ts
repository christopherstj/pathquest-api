import getCloudSqlConnection from "../getCloudSqlConnection";

interface TrailheadFeature {
    type: "Feature";
    properties: {
        id: number;
        osmId: number | null;
        name: string | null;
    };
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
}

const searchTrailheads = async (
    nwLat: number,
    nwLng: number,
    seLat: number,
    seLng: number
): Promise<{ type: "FeatureCollection"; features: TrailheadFeature[] }> => {
    const db = await getCloudSqlConnection();

    const minLng = Math.min(nwLng, seLng);
    const minLat = Math.min(nwLat, seLat);
    const maxLng = Math.max(nwLng, seLng);
    const maxLat = Math.max(nwLat, seLat);

    const result = await db.query(
        `SELECT id, osm_id, name,
                ST_X(location::geometry) AS lng,
                ST_Y(location::geometry) AS lat
         FROM trailheads
         WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
         LIMIT 500`,
        [minLng, minLat, maxLng, maxLat]
    );

    const features: TrailheadFeature[] = result.rows.map((row: any) => ({
        type: "Feature" as const,
        properties: {
            id: row.id,
            osmId: row.osm_id,
            name: row.name,
        },
        geometry: {
            type: "Point" as const,
            coordinates: [parseFloat(row.lng), parseFloat(row.lat)],
        },
    }));

    return { type: "FeatureCollection", features };
};

export default searchTrailheads;
