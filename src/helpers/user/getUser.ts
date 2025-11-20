import User from "../../typeDefs/User";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUser = async (userId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query<User>(
            `SELECT u.id, 
        u.name, 
        u.email,
        u.pic,
        u.update_description,
        u.city,
        u.state,
        u.country,
        ARRAY[ST_X(u.location_coords::geometry), ST_Y(u.location_coords::geometry)] as location_coords,
        u.units,
        u.is_subscribed,
        u.is_lifetime_free,
        u.historical_data_processed,
        COUNT(eq.id) as processing_activity_count
        FROM users u
        LEFT JOIN (
            SELECT id, user_id FROM event_queue WHERE user_id = $1 AND completed IS NULL AND attempts < 5
        ) eq ON eq.user_id = u.id
        WHERE u.id = $2
        GROUP BY u.id
        LIMIT 1;`,
            [userId, userId]
        )
    ).rows;

    const user = rows[0];

    return user;
};

export default getUser;
