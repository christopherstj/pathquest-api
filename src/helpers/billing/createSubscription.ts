import getCloudSqlConnection from "../getCloudSqlConnection";

const createSubscription = async (
    userId: string,
    email: string | null,
    stripeUserId: string | null
) => {
    const db = await getCloudSqlConnection();
    await db.query(
        `UPDATE users SET is_subscribed = true, stripe_user_id = $1, email = $2 WHERE id = $3`,
        [stripeUserId, email, userId]
    );
};

export default createSubscription;
