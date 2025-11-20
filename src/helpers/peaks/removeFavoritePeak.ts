import getCloudSqlConnection from "../getCloudSqlConnection";

const removeFavoritePeak = async (userId: string, peakId: string) => {
    const db = await getCloudSqlConnection();
    await db.query(
        "DELETE FROM user_peak_favorite WHERE user_id = $1 AND peak_id = $2",
        [userId, peakId]
    );
    return;
};

export default removeFavoritePeak;
