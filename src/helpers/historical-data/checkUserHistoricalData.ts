import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";

const checkUserHistoricalData = async (userId: string) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<
        ({
            historicalDataProcessed: boolean;
        } & RowDataPacket)[]
    >(
        `SELECT historicalDataProcessed = 1 historicalDataProcessed
        FROM \`User\` WHERE id = ? LIMIT 1`,
        [userId]
    );

    const user = rows[0];

    connection.end();

    if (!user) {
        return null;
    }

    return user.historicalDataProcessed;
};

export default checkUserHistoricalData;
