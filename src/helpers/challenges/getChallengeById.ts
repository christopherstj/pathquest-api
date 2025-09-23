import { RowDataPacket } from "mysql2";
import Challenge from "../../typeDefs/Challenge";
import db from "../getCloudSqlConnection";

const getChallengeById = async (id: number): Promise<Challenge> => {
    const [rows] = await db.query<(Challenge & RowDataPacket)[]>(
        `SELECT * FROM Challenge WHERE id = ? LIMIT 1`,
        [id]
    );

    return rows[0];
};

export default getChallengeById;
