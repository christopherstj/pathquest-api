import getCloudSqlConnection from "../getCloudSqlConnection";

const getPublicLandDetail = async (objectId: string) => {
    const db = await getCloudSqlConnection();

    const result = await db.query(
        `SELECT objectid, unit_nm, des_tp, mang_name,
                ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom::geometry, 0.001)) AS geometry,
                ST_Y(ST_Centroid(geom::geometry)) AS lat,
                ST_X(ST_Centroid(geom::geometry)) AS lng
         FROM public_lands
         WHERE objectid = $1`,
        [objectId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    return {
        objectId: String(row.objectid),
        name: row.unit_nm,
        designationType: row.des_tp,
        manager: row.mang_name,
        centroid: [parseFloat(row.lng), parseFloat(row.lat)] as [number, number],
        geometry: row.geometry ? JSON.parse(row.geometry) : null,
    };
};

export default getPublicLandDetail;
