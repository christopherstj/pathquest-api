import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteAscent = async (id: string) => {
    const pool = await getCloudSqlConnection();

    const connection1 = await pool.getConnection();

    await connection1.execute(`DELETE FROM ActivityPeak WHERE id = ?`, [id]);

    connection1.release();

    const connection2 = await pool.getConnection();

    await connection2.execute(`DELETE FROM UserPeakManual WHERE id = ?`, [id]);

    connection2.release();
};

export default deleteAscent;
