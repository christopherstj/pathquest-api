import db from "../getCloudSqlConnection";

const removeFavoritePeak = async (userId: string, peakId: string) => {
    await db.query(
        "DELETE FROM UserPeakFavorite WHERE userId = ? AND peakId = ?",
        [userId, peakId]
    );
    return;
};

export default removeFavoritePeak;
