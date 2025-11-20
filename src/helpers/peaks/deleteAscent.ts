import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteAscent = async (id: string) => {
    const db = await getCloudSqlConnection();
    await db.query(`DELETE FROM activities_peaks WHERE id = $1`, [id]);
    await db.query(`DELETE FROM user_peak_manual WHERE id = $1`, [id]);
};

export default deleteAscent;
