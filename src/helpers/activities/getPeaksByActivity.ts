import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeaksByActivity = async (activityId: string): Promise<Peak[]> => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<(Peak & RowDataPacket)[]>(
        `SELECT DISTINCT p.*
        FROM Activity a 
        LEFT JOIN ActivityPeak ap ON a.id = ap.activityId 
        LEFT JOIN Peak p ON ap.peakId = p.Id
        WHERE a.id = ?`,
        [activityId]
    );

    await connection.end();

    return rows;
};

export default getPeaksByActivity;
