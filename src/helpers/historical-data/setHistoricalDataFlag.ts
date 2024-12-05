import getCloudSqlConnection from "../getCloudSqlConnection";

const setHistoricalDataFlag = async (userId: string, value: boolean) => {
    const connection = await getCloudSqlConnection();

    await connection.execute(
        `UPDATE User SET historicalDataProcessed = ? WHERE id = ?`,
        [value, userId]
    );

    await connection.end();
};

export default setHistoricalDataFlag;
