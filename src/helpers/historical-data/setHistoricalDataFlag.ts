import db from "../getCloudSqlConnection";

const setHistoricalDataFlag = async (userId: string, value: boolean) => {
    await db.execute(
        `UPDATE User SET historicalDataProcessed = ? WHERE id = ?`,
        [value, userId]
    );
};

export default setHistoricalDataFlag;
