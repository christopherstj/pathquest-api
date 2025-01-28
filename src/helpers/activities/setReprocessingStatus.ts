import getCloudSqlConnection from "../getCloudSqlConnection";

const setReprocessingStatus = async (activityId: string, status: boolean) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.execute(
        `UPDATE Activity SET pendingReprocess = ? WHERE id = ?`,
        [status, activityId]
    );

    connection.release();
};

export default setReprocessingStatus;
