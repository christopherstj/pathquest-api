import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteChallengeFavorite = async (userId: string, challengeId: string) => {
    const db = await getCloudSqlConnection();
    const query = `
        DELETE FROM user_challenge_favorite
        WHERE user_id = $1 AND challenge_id = $2
    `;

    const result = await db.query(query, [userId, challengeId]);

    return result;
};

export default deleteChallengeFavorite;
