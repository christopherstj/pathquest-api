import { RowDataPacket } from "mysql2";
import db from "../getCloudSqlConnection";

const getIsPeakFavorited = async (userId: string, peakId: string) => {
    const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM UserPeakFavorite WHERE userId = ? AND peakId = ?",
        [userId, peakId]
    );
    return rows.length > 0;
};

export default getIsPeakFavorited;
