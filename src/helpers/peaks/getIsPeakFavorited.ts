import { RowDataPacket } from "mysql2";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getIsPeakFavorited = async (userId: string, peakId: string) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM UserPeakFavorite WHERE userId = ? AND peakId = ?",
        [userId, peakId]
    );

    return rows.length > 0;
};

export default getIsPeakFavorited;
