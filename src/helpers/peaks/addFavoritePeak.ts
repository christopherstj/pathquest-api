import db from "../getCloudSqlConnection";

const addFavoritePeak = async (peakId: string, userId: string) => {
    await db.query(
        "INSERT INTO UserPeakFavorite (peakId, userId) VALUES (?, ?)",
        [peakId, userId]
    );
    return;
};

export default addFavoritePeak;
