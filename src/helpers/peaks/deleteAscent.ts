import db from "../getCloudSqlConnection";

const deleteAscent = async (id: string) => {
    await db.execute(`DELETE FROM ActivityPeak WHERE id = ?`, [id]);
    await db.execute(`DELETE FROM UserPeakManual WHERE id = ?`, [id]);
};

export default deleteAscent;
