import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";

const getCoordsByActivity = async (
    activityId: string
): Promise<[number, number][]> => {
    const [rows] = await db.query<
        { coords: [number, number][] } & RowDataPacket[]
    >("SELECT coords FROM Activity WHERE id = ?", [activityId]);

    return rows[0].coords;
};

export default getCoordsByActivity;
