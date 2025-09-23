import { RowDataPacket } from "mysql2";
import db from "../getCloudSqlConnection";

const getAscentOwnerId = async (ascentId: string): Promise<string | null> => {
    const [rows] = await db.query<({ userId: string } & RowDataPacket)[]>(
        `SELECT a.userId FROM ActivityPeak ap 
        LEFT JOIN Activity a ON ap.activityId = a.id
        WHERE ap.id = ? LIMIT 1`,
        [ascentId]
    );

    if (rows.length === 0) {
        const [rows2] = await db.query<({ userId: string } & RowDataPacket)[]>(
            `SELECT userId FROM UserPeakManual WHERE id = ? LIMIT 1`,
            [ascentId]
        );

        if (rows2.length === 0) {
            return null;
        }

        return rows2[0].userId;
    }

    return rows[0].userId;
};

export default getAscentOwnerId;
