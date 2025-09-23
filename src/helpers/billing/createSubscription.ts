import db from "../getCloudSqlConnection";

const createSubscription = async (
    userId: string,
    email: string | null,
    stripeUserId: string | null
) => {
    await db.execute(
        `UPDATE User SET isSubscribed = 1, stripeUserId = ?, email = ? WHERE id = ?`,
        [stripeUserId, email, userId]
    );
};

export default createSubscription;
