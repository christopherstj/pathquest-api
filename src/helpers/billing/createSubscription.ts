import getCloudSqlConnection from "../getCloudSqlConnection";

const createSubscription = async (
    userId: string,
    email: string | null,
    stripeUserId: string | null
) => {
    const connection = await getCloudSqlConnection();

    await connection.execute(
        `UPDATE User SET isSubscribed = 1, stripeUserId = ?, email = ? WHERE id = ?`,
        [stripeUserId, email, userId]
    );

    await connection.end();
};

export default createSubscription;
