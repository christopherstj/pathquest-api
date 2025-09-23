import { RowDataPacket } from "mysql2";
import db from "../getCloudSqlConnection";

const checkUserHistoricalData = async (userId: string) => {
    const [rows] = await db.query<
        ({
            historicalDataProcessed: boolean;
        } & RowDataPacket)[]
    >(
        `SELECT historicalDataProcessed = 1 historicalDataProcessed
        FROM \`User\` WHERE id = ? LIMIT 1`,
        [userId]
    );

    const user = rows[0];

    if (!user) {
        return null;
    }

    return user.historicalDataProcessed;
};

export default checkUserHistoricalData;
