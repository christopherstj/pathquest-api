import { RowDataPacket } from "mysql2";
import db from "./getCloudSqlConnection";
import StravaRateLimit from "../typeDefs/StravaRateLimit";

const checkRateLimit = async () => {
    const [rows] = await db.query<(StravaRateLimit & RowDataPacket)[]>(`
        SELECT * FROM StravaRateLimit
    `);

    if (rows.length === 0) {
        return false;
    }

    const rateLimit = rows[0];

    if (rateLimit.shortTermLimit - rateLimit.shortTermUsage < 3) {
        return false;
    }

    if (rateLimit.dailyLimit - rateLimit.dailyUsage < 3) {
        return false;
    }

    return true;
};

export default checkRateLimit;
