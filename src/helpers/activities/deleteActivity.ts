import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteActivity = async (activityId: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.execute(`DELETE FROM Activity WHERE id = ?`, [activityId]);
    await connection.execute(
        `DELETE FROM UserPeakManual WHERE activityId = ?`,
        [activityId]
    );

    connection.release();
};

export default deleteActivity;
