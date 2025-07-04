import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUserPrivacy = async (userId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const query = `
        SELECT isPublic FROM \`User\` WHERE id = ?
    `;

    const [rows] = await connection.query<
        ({ isPublic: boolean } & RowDataPacket)[]
    >(query, [userId]);

    connection.release();

    if (rows.length === 0) {
        return null;
    }

    return rows[0].isPublic;
};

export default getUserPrivacy;
