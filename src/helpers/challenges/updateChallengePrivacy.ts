import getCloudSqlConnection from "../getCloudSqlConnection";

const updateChallengePrivacy = async (
    userId: string,
    challengeId: string,
    isPublic: boolean
) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const query = `
        UPDATE UserChallengeFavorite
        SET isPublic = ?
        WHERE userId = ? AND challengeId = ?
    `;

    const [result] = await connection.query(query, [
        isPublic,
        userId,
        challengeId,
    ]);

    connection.release();

    return result;
};

export default updateChallengePrivacy;
