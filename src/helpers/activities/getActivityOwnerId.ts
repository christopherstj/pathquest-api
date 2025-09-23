import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";

const getActivityOwnerId = async (
    activityId: string
): Promise<string | null> => {
    const [rows] = await db.query<({ userId: string } & RowDataPacket)[]>(
        `SELECT userId FROM Activity WHERE id = ? LIMIT 1`,
        [activityId]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0].userId;
};

export default getActivityOwnerId;
