import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getReprocessingStatus = async (activityId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.execute<
        ({ reprocessing: boolean } & RowDataPacket)[]
    >(`SELECT pendingReprocess = 1 reprocessing FROM Activity WHERE id = ?`, [
        activityId,
    ]);

    connection.release();

    if (rows.length === 0) {
        return null;
    }

    return rows[0].reprocessing;
};

export default getReprocessingStatus;
