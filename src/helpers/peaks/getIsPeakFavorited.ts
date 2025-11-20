import getCloudSqlConnection from "../getCloudSqlConnection";

const getIsPeakFavorited = async (userId: string, peakId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            "SELECT * FROM user_peak_favorite WHERE user_id = $1 AND peak_id = $2",
            [userId, peakId]
        )
    ).rows;
    return rows.length > 0;
};

export default getIsPeakFavorited;
