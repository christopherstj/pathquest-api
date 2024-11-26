import { RowDataPacket } from "mysql2/promise";
import Activity from "../../typeDefs/Activity";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getActivityById = async (
    activityId: string
): Promise<Activity | null> => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<(Activity & RowDataPacket)[]>(
        `
        SELECT a.*
        FROM Activity a
        WHERE a.id = ?
        LIMIT 1
    `,
        [activityId]
    );

    await connection.end();

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
};

export default getActivityById;
