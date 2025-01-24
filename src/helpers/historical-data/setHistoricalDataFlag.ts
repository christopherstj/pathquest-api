import getCloudSqlConnection from "../getCloudSqlConnection";

const setHistoricalDataFlag = async (userId: string, value: boolean) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.execute(
        `UPDATE User SET historicalDataProcessed = ? WHERE id = ?`,
        [value, userId]
    );

    connection.release();
};

export default setHistoricalDataFlag;
