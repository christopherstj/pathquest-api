import UserChallenge from "../../typeDefs/UserChallenge";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Challenge from "../../typeDefs/Challenge";

const getChallengeByUserAndId = async (
    id: number,
    userId?: string
): Promise<UserChallenge | Challenge> => {
    const db = await getCloudSqlConnection();
    const query = userId
        ? `
        SELECT c.*, ucf.user_id IS NOT NULL AS is_favorited, ucf.is_public
        FROM challenges c 
        LEFT JOIN (
            SELECT * FROM user_challenge_favorite WHERE user_id = $1
        ) ucf ON c.id = ucf.challenge_id
        WHERE c.id = $2
        LIMIT 1
    `
        : `SELECT * FROM challenges WHERE id = $1 LIMIT 1`;

    const rows = (await db.query(query, userId ? [userId, id] : [id])).rows as (
        | UserChallenge
        | Challenge
    )[];

    return rows[0];
};

export default getChallengeByUserAndId;
