import { RowDataPacket } from "mysql2";
import UserChallenge from "../../typeDefs/UserChallenge";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Challenge from "../../typeDefs/Challenge";

const getChallengeByUserAndId = async (
    id: number,
    userId?: string
): Promise<UserChallenge | Challenge> => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const query = userId
        ? `
        SELECT c.*, ucf.userId IS NOT NULL isFavorited, ucf.isPublic = 1 isPublic
        FROM Challenge c 
        LEFT JOIN (
            SELECT * FROM UserChallengeFavorite WHERE userId = ?
        ) ucf ON c.id = ucf.challengeId
        WHERE c.id = ?
        LIMIT 1;
    `
        : `SELECT * FROM Challenge WHERE id = ? LIMIT 1`;

    const [rows] = await connection.query<
        ((UserChallenge | Challenge) & RowDataPacket)[]
    >(query, [userId, id]);

    connection.release();

    return rows[0];
};

export default getChallengeByUserAndId;
