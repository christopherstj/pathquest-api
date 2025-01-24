import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteSubscription = async (stripeUserId: string | null) => {
    if (!stripeUserId) {
        return;
    }

    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.execute(
        `UPDATE User SET isSubscribed = 0 WHERE stripeUserId = ?`,
        [stripeUserId]
    );

    connection.release();
};

export default deleteSubscription;
