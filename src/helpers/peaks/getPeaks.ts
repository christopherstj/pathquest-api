import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeaks = async (page: number, perPage: number, search?: string) => {
    const db = await getCloudSqlConnection();
    const skip = (page - 1) * perPage;

    if (search) {
        const rows = (
            await db.query(
                `SELECT id, name, elevation, county, state, country,
                 ARRAY[ST_X(location_coords::geometry), ST_Y(location_coords::geometry)] as location_coords
                 FROM peaks WHERE LOWER(name) LIKE CONCAT('%', $1, '%') ORDER BY elevation DESC LIMIT $2 OFFSET $3`,
                [search.toLocaleLowerCase(), perPage, skip]
            )
        ).rows as Peak[];
        return rows;
    } else {
        const rows = (
            await db.query(
                `SELECT id, name, elevation, county, state, country,
                 ARRAY[ST_X(location_coords::geometry), ST_Y(location_coords::geometry)] as location_coords
                 FROM peaks ORDER BY elevation DESC LIMIT $1 OFFSET $2`,
                [perPage, skip]
            )
        ).rows as Peak[];
        return rows;
    }
};

export default getPeaks;
