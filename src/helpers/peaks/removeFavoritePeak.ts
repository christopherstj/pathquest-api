import getCloudSqlConnection from "../getCloudSqlConnection";

const removeFavoritePeak = async (userId: string, peakId: string) => {
    const connection = await getCloudSqlConnection();

    await connection.query(
        "DELETE FROM UserPeakFavorite WHERE userId = ? AND peakId = ?",
        [userId, peakId]
    );

    return;
};

export default removeFavoritePeak;
