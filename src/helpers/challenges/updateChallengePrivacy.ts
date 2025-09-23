import db from "../getCloudSqlConnection";

const updateChallengePrivacy = async (
    userId: string,
    challengeId: string,
    isPublic: boolean
) => {
    const query = `
        UPDATE UserChallengeFavorite
        SET isPublic = ?
        WHERE userId = ? AND challengeId = ?
    `;

    const [result] = await db.query(query, [isPublic, userId, challengeId]);

    return result;
};

export default updateChallengePrivacy;
