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
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<
        ({ timestamp: string } & RowDataPacket)[]
    >(
        `SELECT ap.\`timestamp\`
        FROM Activity a 
        LEFT JOIN (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap ON a.id = ap.activityId 
        LEFT JOIN Peak p ON ap.peakId = p.Id
        WHERE a.id = ? AND p.Id = ?`,
        [activityId, peakId]
    );

    connection.release();

    return rows;
};

export default getSummitsByPeakAndActivity;
