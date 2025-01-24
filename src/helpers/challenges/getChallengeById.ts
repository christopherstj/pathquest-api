import { RowDataPacket } from "mysql2";
import Challenge from "../../typeDefs/Challenge";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getChallengeById = async (id: number): Promise<Challenge> => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const [rows] = await connection.query<(Challenge & RowDataPacket)[]>(
        `SELECT * FROM Challenge WHERE id = ? LIMIT 1`,
        [id]
    );

    connection.release();

    return rows[0];
};

export default getChallengeById;
