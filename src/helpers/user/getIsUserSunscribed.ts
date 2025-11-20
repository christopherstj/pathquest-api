import getCloudSqlConnection from "../getCloudSqlConnection";

const getIsUserSubscribed = async (userId: string): Promise<boolean> => {
    const db = await getCloudSqlConnection();
    const query = `SELECT is_subscribed,
        is_lifetime_free FROM users WHERE id = $1;`;

    const rows = (await db.query(query, [userId])).rows as {
        is_subscribed: boolean;
        is_lifetime_free: boolean;
    }[];

    if (rows.length === 0) {
        return false;
    }

    const { is_subscribed, is_lifetime_free } = rows[0];

    return is_subscribed || is_lifetime_free;
};

export default getIsUserSubscribed;
