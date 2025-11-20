import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteActivity = async (activityId: string) => {
    const db = await getCloudSqlConnection();

    await db.query(`DELETE FROM activities WHERE id = $1`, [activityId]);
    await db.query(`DELETE FROM user_peak_manual WHERE activity_id = $1`, [
        activityId,
    ]);
};

export default deleteActivity;
