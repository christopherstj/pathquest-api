import UserChallengeFavorite from "../../typeDefs/UserChallengeFavorite";
import getCloudSqlConnection from "../getCloudSqlConnection";

const addChallengeFavorite = async (favorite: UserChallengeFavorite) => {
    const db = await getCloudSqlConnection();
    const query = `
        INSERT INTO user_challenge_favorite (user_id, challenge_id, is_public)
        VALUES ($1, $2, $3)
    `;

    const result = await db.query(query, [
        favorite.user_id,
        favorite.challenge_id,
        favorite.is_public,
    ]);

    return result;
};

export default addChallengeFavorite;
