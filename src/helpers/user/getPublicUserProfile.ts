import getCloudSqlConnection from "../getCloudSqlConnection";
import User from "../../typeDefs/User";

const getPublicUserProfile = async (userId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `
        SELECT is_public FROM users WHERE id = $1
    `,
            [userId]
        )
    ).rows as { is_public: boolean }[];

    const isPublic = rows.length > 0 ? rows[0].is_public : false;

    if (isPublic) {
        const profileRows = (
            await db.query<User>(
                `SELECT id, 
                name, 
                email,
                pic,
                city,
                state,
                country,
                ARRAY[ST_X(location_coords::geometry), ST_Y(location_coords::geometry)] as location_coords,
                is_subscribed,
                is_lifetime_free
                FROM users WHERE id = $1 LIMIT 1`,
                [userId]
            )
        ).rows;

        return profileRows[0];
    } else {
        return null;
    }
};

export default getPublicUserProfile;
