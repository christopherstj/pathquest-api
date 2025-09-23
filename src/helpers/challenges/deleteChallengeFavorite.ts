import db from "../getCloudSqlConnection";

const deleteChallengeFavorite = async (userId: string, challengeId: string) => {
    const query = `
        DELETE FROM UserChallengeFavorite
        WHERE userId = ? AND challengeId = ?
    `;

    const [result] = await db.query(query, [userId, challengeId]);

    return result;
};

export default deleteChallengeFavorite;
