import AscentDetail from "../../typeDefs/AscentDetail";
import getCloudSqlConnection from "../getCloudSqlConnection";

const updateAscent = async (ascent: AscentDetail) => {
    const db = await getCloudSqlConnection();
    await db.query(
        `UPDATE activities_peaks SET timestamp = $1, notes = $2, is_public = $3, difficulty = $4, experience_rating = $5 WHERE id = $6`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.is_public,
            ascent.difficulty || null,
            ascent.experience_rating || null,
            ascent.id,
        ]
    );

    await db.query(
        `UPDATE user_peak_manual SET timestamp = $1, notes = $2, is_public = $3, difficulty = $4, experience_rating = $5 WHERE id = $6`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.is_public,
            ascent.difficulty || null,
            ascent.experience_rating || null,
            ascent.id,
        ]
    );
};

export default updateAscent;
