import User from "../../typeDefs/User";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUser = async (userId: string) => {
    const db = await getCloudSqlConnection();
    
    // First get the user data without GROUP BY to ensure all columns are included
    const userRows = (
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
        u.is_public
        FROM users u
        WHERE u.id = $1
        LIMIT 1;`,
            [userId]
        )
    ).rows;

    const user = userRows[0];
    
    if (!user) {
        return null;
    }

    // Then get the processing count separately
    const countRows = (
        await db.query<{ count: number }>(
            `SELECT COUNT(eq.id) as count
            FROM event_queue eq
            WHERE eq.user_id = $1 AND eq.completed IS NULL AND eq.attempts < 5`,
            [userId]
        )
    ).rows;

    user.processing_activity_count = countRows[0]?.count || 0;
    
    // Ensure boolean fields are properly converted (PostgreSQL may return as string in some cases)
    user.update_description = Boolean(user.update_description);
    user.is_subscribed = Boolean(user.is_subscribed);
    user.is_lifetime_free = Boolean(user.is_lifetime_free);
    user.historical_data_processed = Boolean(user.historical_data_processed);
    if (user.is_public !== undefined) {
        user.is_public = Boolean(user.is_public);
    }

    return user;
};

export default getUser;
