import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeak = async (peakId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<(Peak & RowDataPacket)[]>(
        `SELECT * FROM Peak WHERE Id = ? LIMIT 1`,
        [peakId]
    );

    connection.release();

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
};

export default getPeak;
