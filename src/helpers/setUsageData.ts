// UNUSED - Not imported in any route files (used in backend workers)
import StravaRateLimit from "../typeDefs/StravaRateLimit";
import getCloudSqlConnection from "./getCloudSqlConnection";

const setUsageData = async (headers: Headers) => {
    const db = await getCloudSqlConnection();
    const limitHeader = headers.get("X-ReadRateLimit-Limit");
    const usageHeader = headers.get("X-ReadRateLimit-Usage");

    if (!limitHeader || !usageHeader) {
        return;
    }

    const [shortTermLimit, dailyLimit] = limitHeader.split(",");
    const [shortTermUsage, dailyUsage] = usageHeader.split(",");

    await db.query(
        `UPDATE strava_rate_limits SET short_term_limit = $1, daily_limit = $2, short_term_usage = $3, daily_usage = $4`,
        [shortTermLimit, dailyLimit, shortTermUsage, dailyUsage]
    );
};

export default setUsageData;
