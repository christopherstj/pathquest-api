import getCloudSqlConnection from "../getCloudSqlConnection";

const getActivityOwnerId = async (
    activityId: string
): Promise<string | null> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query<{ user_id: string }>(
            `SELECT user_id FROM activities WHERE id = $1 LIMIT 1`,
            [activityId]
        )
    ).rows;

    if (rows.length === 0) {
        return null;
    }

    return rows[0].user_id;
};

export default getActivityOwnerId;
