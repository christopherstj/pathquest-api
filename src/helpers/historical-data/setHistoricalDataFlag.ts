import getCloudSqlConnection from "../getCloudSqlConnection";

const setHistoricalDataFlag = async (userId: string, value: boolean) => {
    const db = await getCloudSqlConnection();
    await db.query(
        `UPDATE users SET historical_data_processed = $1 WHERE id = $2`,
        [value, userId]
    );
};

export default setHistoricalDataFlag;
