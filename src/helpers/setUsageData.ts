import StravaRateLimit from "../typeDefs/StravaRateLimit";
import getCloudSqlConnection from "./getCloudSqlConnection";

const setUsageData = async (headers: Headers) => {
    const limitHeader = headers.get("X-ReadRateLimit-Limit");
    const usageHeader = headers.get("X-ReadRateLimit-Usage");

    if (!limitHeader || !usageHeader) {
        return;
    }

    const [shortTermLimit, dailyLimit] = limitHeader.split(",");
    const [shortTermUsage, dailyUsage] = usageHeader.split(",");

    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.execute(
        `UPDATE StravaRateLimit SET shortTermLimit = ?, dailyLimit = ?, shortTermUsage = ?, dailyUsage = ?`,
        [shortTermLimit, dailyLimit, shortTermUsage, dailyUsage]
    );

    connection.release();
};

export default setUsageData;
