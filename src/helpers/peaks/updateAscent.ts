import { format } from "mysql2";
import AscentDetail from "../../typeDefs/AscentDetail";
import db from "../getCloudSqlConnection";

const updateAscent = async (ascent: AscentDetail) => {
    await db.execute(
        `UPDATE ActivityPeak SET timestamp = ?, notes = ?, isPublic = ? WHERE id = ?`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.isPublic ? 1 : 0,
            ascent.id,
        ]
    );

    await db.execute(
        `UPDATE UserPeakManual SET timestamp = ?, notes = ?, isPublic = ? WHERE id = ?`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.isPublic ? 1 : 0,
            ascent.id,
        ]
    );
};

export default updateAscent;
