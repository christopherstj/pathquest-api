import getCloudSqlConnection from "../getCloudSqlConnection";

const getActivitiesProcessing = async (userId: string) => {
    const db = await getCloudSqlConnection();
    const query = `
        SELECT COUNT(*) AS num_activities FROM event_queue WHERE user_id = $1 AND completed IS NULL AND attempts < 5;
    `;

    const rows = (
        await db.query<{
            num_activities: number;
        }>(query, [userId])
    ).rows;
    return rows[0]?.num_activities ?? 0;
};

export default getActivitiesProcessing;
