import getCloudSqlConnection from "../getCloudSqlConnection";
import AscentDetail from "../../typeDefs/AscentDetail";

const getAscentDetails = async (ascentId: string, userId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT * FROM (
            SELECT a.timezone, a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public FROM activities_peaks ap
            LEFT JOIN activities a ON ap.activity_id = a.id
            UNION
            SELECT timezone, user_id, id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
        ) ap WHERE ap.id = $1 AND ap.user_id = $2 LIMIT 1`,
            [ascentId, userId]
        )
    ).rows as AscentDetail[];

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
};

export default getAscentDetails;
