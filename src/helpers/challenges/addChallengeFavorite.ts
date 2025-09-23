import UserChallengeFavorite from "../../typeDefs/UserChallengeFavorite";
import db from "../getCloudSqlConnection";

const addChallengeFavorite = async (favorite: UserChallengeFavorite) => {
    const query = `
        INSERT INTO UserChallengeFavorite (userId, challengeId, isPublic)
        VALUES (?, ?, ?)
    `;

    const [result] = await db.query(query, [
        favorite.userId,
        favorite.challengeId,
        favorite.isPublic,
    ]);

    return result;
};

export default addChallengeFavorite;
