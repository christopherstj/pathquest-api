// UNUSED - Not imported in any route files (used in backend workers)
import getCloudSqlConnection from "./getCloudSqlConnection";
import StravaRateLimit from "../typeDefs/StravaRateLimit";

const checkRateLimit = async () => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(`
        SELECT * FROM strava_rate_limits
    `)
    ).rows as StravaRateLimit[];

    if (rows.length === 0) {
        return false;
    }

    const rateLimit = rows[0];

    if (rateLimit.short_term_limit - rateLimit.short_term_usage < 3) {
        return false;
    }

    if (rateLimit.daily_limit - rateLimit.daily_usage < 3) {
        return false;
    }

    return true;
};

export default checkRateLimit;
