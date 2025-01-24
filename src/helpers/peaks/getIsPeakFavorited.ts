import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getIsPeakFavorited = async (userId: string, peakId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM UserPeakFavorite WHERE userId = ? AND peakId = ?",
        [userId, peakId]
    );

    connection.release();

    return rows.length > 0;
};

export default getIsPeakFavorited;
