import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeaks = async (page: number, perPage: number, search?: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const skip = (page - 1) * perPage;

    if (search) {
        const [rows] = await connection.query<(Peak & RowDataPacket)[]>(
            `SELECT * FROM Peak WHERE LOWER(\`Name\`) LIKE CONCAT('%', ?, '%') ORDER BY Altitude DESC LIMIT ? OFFSET ?`,
            [search.toLocaleLowerCase(), perPage, skip]
        );

        connection.release();

        return rows;
    } else {
        const [rows] = await connection.query<(Peak & RowDataPacket)[]>(
            `SELECT * FROM Peak ORDER BY Altitude DESC LIMIT ? OFFSET ?`,
            [perPage, skip]
        );

        connection.release();

        return rows;
    }
};

export default getPeaks;
