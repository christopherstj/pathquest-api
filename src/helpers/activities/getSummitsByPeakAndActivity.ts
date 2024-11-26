import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getSummitsByPeakAndActivity = async (
    peakId: string,
    activityId: string
): Promise<
    {
        timestamp: string;
    }[]
> => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<
        ({ timestamp: string } & RowDataPacket)[]
    >(
        `SELECT ap.\`timestamp\`
        FROM Activity a 
        LEFT JOIN ActivityPeak ap ON a.id = ap.activityId 
        LEFT JOIN Peak p ON ap.peakId = p.Id
        WHERE a.id = ? AND p.Id = ?`,
        [activityId, peakId]
    );

    await connection.end();

    return rows;
};

export default getSummitsByPeakAndActivity;
