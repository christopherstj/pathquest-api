import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByActivity = async (activityId: string) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<
        ({ timestamp: string } & RowDataPacket)[]
    >(
        "SELECT ap.`timestamp` FROM Activity a LEFT JOIN ActivityPeak ap ON a.id = ap.activityId WHERE a.id = ?",
        [activityId]
    );

    await connection.end();

    return rows;
};

export default getSummitsByActivity;
