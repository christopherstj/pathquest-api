import getCloudSqlConnection from "../getCloudSqlConnection";

const removeFavoritePeak = async (userId: string, peakId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.query(
        "DELETE FROM UserPeakFavorite WHERE userId = ? AND peakId = ?",
        [userId, peakId]
    );

    connection.release();

    return;
};

export default removeFavoritePeak;
