import getCloudSqlConnection from "../getCloudSqlConnection";

const updateChallengePrivacy = async (
    userId: string,
    challengeId: string,
    isPublic: boolean
) => {
    const db = await getCloudSqlConnection();
    const query = `
        UPDATE user_challenge_favorite
        SET is_public = $1
        WHERE user_id = $2 AND challenge_id = $3
    `;

    const result = await db.query(query, [isPublic, userId, challengeId]);

    return result;
};

export default updateChallengePrivacy;
