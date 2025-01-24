import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getActivityOwnerId = async (
    activityId: string
): Promise<string | null> => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<
        ({ userId: string } & RowDataPacket)[]
    >(`SELECT userId FROM Activity WHERE id = ? LIMIT 1`, [activityId]);

    connection.release();

    if (rows.length === 0) {
        return null;
    }

    return rows[0].userId;
};

export default getActivityOwnerId;
