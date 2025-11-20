import { format } from "mysql2";
import AscentDetail from "../../typeDefs/AscentDetail";
import getCloudSqlConnection from "../getCloudSqlConnection";

const updateAscent = async (ascent: AscentDetail) => {
    const db = await getCloudSqlConnection();
    await db.query(
        `UPDATE activities_peaks SET timestamp = $1, notes = $2, is_public = $3 WHERE id = $4`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.is_public,
            ascent.id,
        ]
    );

    await db.query(
        `UPDATE user_peak_manual SET timestamp = $1, notes = $2, is_public = $3 WHERE id = $4`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.is_public,
            ascent.id,
        ]
    );
};

export default updateAscent;
