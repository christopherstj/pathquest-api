import { RowDataPacket } from "mysql2";
import db from "../getCloudSqlConnection";

const getIsUserSubscribed = async (userId: string): Promise<boolean> => {
    const query = `SELECT isSubscribed = 1 isSubscribed,
        isLifetimeFree = 1 isLifetimeFree FROM \`User\` WHERE id = ?;`;

    const [rows] = await db.execute<
        ({ isSubscribed: boolean; isLifetimeFree: boolean } & RowDataPacket)[]
    >(query, [userId]);

    if (rows.length === 0) {
        return false;
    }

    const { isSubscribed, isLifetimeFree } = rows[0];

    return isSubscribed || isLifetimeFree;
};

export default getIsUserSubscribed;
