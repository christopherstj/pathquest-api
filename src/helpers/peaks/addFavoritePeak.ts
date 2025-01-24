import getCloudSqlConnection from "../getCloudSqlConnection";

const addFavoritePeak = async (peakId: string, userId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.query(
        "INSERT INTO UserPeakFavorite (peakId, userId) VALUES (?, ?)",
        [peakId, userId]
    );

    connection.release();

    return;
};

export default addFavoritePeak;
