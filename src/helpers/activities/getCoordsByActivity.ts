import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getCoordsByActivity = async (
    activityId: string
): Promise<[number, number][]> => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<
        { coords: [number, number][] } & RowDataPacket[]
    >("SELECT coords FROM Activity WHERE id = ?", [activityId]);

    await connection.end();

    return rows[0].coords;
};

export default getCoordsByActivity;
