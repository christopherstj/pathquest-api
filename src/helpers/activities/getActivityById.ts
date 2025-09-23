import { RowDataPacket } from "mysql2/promise";
import Activity from "../../typeDefs/Activity";
import db from "../getCloudSqlConnection";

const getActivityById = async (
    activityId: string
): Promise<Activity | null> => {
    const [rows] = await db.query<(Activity & RowDataPacket)[]>(
        `
        SELECT a.*, pendingReprocess = 1 reprocessing
        FROM Activity a
        WHERE a.id = ?
        LIMIT 1
    `,
        [activityId]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
};

export default getActivityById;
