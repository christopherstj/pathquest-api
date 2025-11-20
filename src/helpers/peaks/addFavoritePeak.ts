import getCloudSqlConnection from "../getCloudSqlConnection";

const addFavoritePeak = async (peakId: string, userId: string) => {
    const db = await getCloudSqlConnection();
    await db.query(
        "INSERT INTO user_peak_favorite (peak_id, user_id) VALUES ($1, $2)",
        [peakId, userId]
    );
    return;
};

export default addFavoritePeak;
