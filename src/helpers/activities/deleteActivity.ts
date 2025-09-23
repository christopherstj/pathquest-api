import db from "../getCloudSqlConnection";

const deleteActivity = async (activityId: string) => {
    await db.execute(`DELETE FROM Activity WHERE id = ?`, [activityId]);
    await db.execute(`DELETE FROM UserPeakManual WHERE activityId = ?`, [
        activityId,
    ]);
};

export default deleteActivity;
