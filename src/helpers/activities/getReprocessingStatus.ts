import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";

const getReprocessingStatus = async (activityId: string) => {
    const [rows] = await db.execute<
        ({ reprocessing: boolean } & RowDataPacket)[]
    >(`SELECT pendingReprocess = 1 reprocessing FROM Activity WHERE id = ?`, [
        activityId,
    ]);

    if (rows.length === 0) {
        return null;
    }

    return rows[0].reprocessing;
};

export default getReprocessingStatus;
