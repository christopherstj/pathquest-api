import db from "../getCloudSqlConnection";

const deleteSubscription = async (stripeUserId: string | null) => {
    if (!stripeUserId) {
        return;
    }

    await db.execute(
        `UPDATE User SET isSubscribed = 0 WHERE stripeUserId = ?`,
        [stripeUserId]
    );
};

export default deleteSubscription;
