import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteSubscription = async (stripeUserId: string | null) => {
    if (!stripeUserId) {
        return;
    }

    const db = await getCloudSqlConnection();
    await db.query(
        `UPDATE users SET is_subscribed = false WHERE stripe_user_id = $1`,
        [stripeUserId]
    );
};

export default deleteSubscription;
