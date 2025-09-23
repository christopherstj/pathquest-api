import db from "../getCloudSqlConnection";

const setReprocessingStatus = async (activityId: string, status: boolean) => {
    await db.execute(`UPDATE Activity SET pendingReprocess = ? WHERE id = ?`, [
        status,
        activityId,
    ]);
};

export default setReprocessingStatus;
