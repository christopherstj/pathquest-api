import getCloudSqlConnection from "../getCloudSqlConnection";

const getCoordsByActivity = async (
    activityId: string
): Promise<[number, number][]> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT (SELECT json_agg(json_build_array(ST_X(geom), ST_Y(geom)) ORDER BY path)
                     FROM (SELECT (dp).geom, (dp).path FROM ST_DumpPoints(coords::geometry) dp) pts) as coords
             FROM activities WHERE id = $1`,
            [activityId]
        )
    ).rows as { coords: [number, number][] }[];

    return rows[0].coords;
};

export default getCoordsByActivity;
