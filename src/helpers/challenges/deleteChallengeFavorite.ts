import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteChallengeFavorite = async (userId: string, challengeId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const query = `
        DELETE FROM UserChallengeFavorite
        WHERE userId = ? AND challengeId = ?
    `;

    const [result] = await connection.query(query, [userId, challengeId]);

    connection.release();

    return result;
};

export default deleteChallengeFavorite;
