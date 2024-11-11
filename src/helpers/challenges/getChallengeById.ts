import { RowDataPacket } from "mysql2";
import Challenge from "../../typeDefs/Challenge";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getChallengeById = async (id: number): Promise<Challenge> => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<(Challenge & RowDataPacket)[]>(
        `SELECT * FROM Challenge WHERE id = ? LIMIT 1`,
        [id]
    );

    await connection.end();

    return rows[0];
};

export default getChallengeById;
