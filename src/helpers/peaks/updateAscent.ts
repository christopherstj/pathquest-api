import AscentDetail from "../../typeDefs/AscentDetail";
import getCloudSqlConnection from "../getCloudSqlConnection";

const updateAscent = async (ascent: AscentDetail) => {
    const db = await getCloudSqlConnection();
    
    // Convert condition_tags array to PostgreSQL array format
    const conditionTags = ascent.condition_tags || [];
    // Convert custom_condition_tags to JSONB
    const customConditionTags = JSON.stringify(ascent.custom_condition_tags || []);
    
    await db.query(
        `UPDATE activities_peaks SET timestamp = $1, notes = $2, is_public = $3, difficulty = $4, experience_rating = $5, condition_tags = $6, custom_condition_tags = $7 WHERE id = $8`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.is_public,
            ascent.difficulty || null,
            ascent.experience_rating || null,
            conditionTags,
            customConditionTags,
            ascent.id,
        ]
    );

    await db.query(
        `UPDATE user_peak_manual SET timestamp = $1, notes = $2, is_public = $3, difficulty = $4, experience_rating = $5, condition_tags = $6, custom_condition_tags = $7 WHERE id = $8`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.is_public,
            ascent.difficulty || null,
            ascent.experience_rating || null,
            conditionTags,
            customConditionTags,
            ascent.id,
        ]
    );
};

export default updateAscent;
