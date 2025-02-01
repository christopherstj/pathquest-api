import AscentDetail from "../../typeDefs/AscentDetail";
import getCloudSqlConnection from "../getCloudSqlConnection";

const updateAscent = async (ascent: AscentDetail) => {
    const pool = await getCloudSqlConnection();

    const connection1 = await pool.getConnection();

    await connection1.execute(
        `UPDATE ActivityPeak SET timestamp = ?, notes = ?, isPublic = ? WHERE id = ?`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.isPublic,
            ascent.id,
        ]
    );

    connection1.release();

    const connection2 = await pool.getConnection();

    await connection2.execute(
        `UPDATE UserPeakManual SET timestamp = ?, notes = ?, isPublic = ? WHERE id = ?`,
        [
            ascent.timestamp.replace("T", " ").replace("Z", ""),
            ascent.notes,
            ascent.isPublic,
            ascent.id,
        ]
    );

    connection2.release();
};

export default updateAscent;
