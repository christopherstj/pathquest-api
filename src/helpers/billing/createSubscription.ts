import getCloudSqlConnection from "../getCloudSqlConnection";

const createSubscription = async (
    userId: string,
    email: string | null,
    stripeUserId: string | null
) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.execute(
        `UPDATE User SET isSubscribed = 1, stripeUserId = ?, email = ? WHERE id = ?`,
        [stripeUserId, email, userId]
    );

    connection.release();
};

export default createSubscription;
