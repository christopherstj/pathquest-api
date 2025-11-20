import getCloudSqlConnection from "../getCloudSqlConnection";

const checkUserHistoricalData = async (userId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT historical_data_processed
            FROM users WHERE id = $1`,
            [userId]
        )
    ).rows as {
        historical_data_processed: boolean;
    }[];

    const user = rows[0];

    if (!user) {
        return null;
    }

    return user.historical_data_processed;
};

export default checkUserHistoricalData;
