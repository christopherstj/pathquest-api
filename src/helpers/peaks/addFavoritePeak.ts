import getCloudSqlConnection from "../getCloudSqlConnection";

const addFavoritePeak = async (peakId: string, userId: string) => {
    const connection = await getCloudSqlConnection();

    await connection.query(
        "INSERT INTO UserPeakFavorite (peakId, userId) VALUES (?, ?)",
        [peakId, userId]
    );

    await connection.release();

    return;
};

export default addFavoritePeak;
