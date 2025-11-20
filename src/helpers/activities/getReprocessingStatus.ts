import getCloudSqlConnection from "../getCloudSqlConnection";

const getReprocessingStatus = async (activityId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT pending_reprocess AS reprocessing FROM activities WHERE id = $1`,
            [activityId]
        )
    ).rows as { reprocessing: boolean }[];

    if (rows.length === 0) {
        return null;
    }

    return rows[0].reprocessing;
};

export default getReprocessingStatus;
