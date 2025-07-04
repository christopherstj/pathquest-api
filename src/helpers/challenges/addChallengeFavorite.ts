import UserChallengeFavorite from "../../typeDefs/UserChallengeFavorite";
import getCloudSqlConnection from "../getCloudSqlConnection";

const addChallengeFavorite = async (favorite: UserChallengeFavorite) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const query = `
        INSERT INTO UserChallengeFavorite (userId, challengeId, isPublic)
        VALUES (?, ?, ?)
    `;

    const [result] = await connection.query(query, [
        favorite.userId,
        favorite.challengeId,
        favorite.isPublic,
    ]);

    connection.release();

    return result;
};

export default addChallengeFavorite;
