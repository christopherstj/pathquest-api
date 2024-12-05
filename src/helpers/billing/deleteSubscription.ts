import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteSubscription = async (stripeUserId: string | null) => {
    if (!stripeUserId) {
        return;
    }

    const connection = await getCloudSqlConnection();

    await connection.execute(
        `UPDATE User SET isSubscribed = 0 WHERE stripeUserId = ?`,
        [stripeUserId]
    );

    await connection.end();
};

export default deleteSubscription;
