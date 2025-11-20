import getCloudSqlConnection from "../getCloudSqlConnection";

const setReprocessingStatus = async (activityId: string, status: boolean) => {
    const db = await getCloudSqlConnection();
    await db.query(
        `UPDATE activities SET pending_reprocess = $1 WHERE id = $2`,
        [status, activityId]
    );
};

export default setReprocessingStatus;
