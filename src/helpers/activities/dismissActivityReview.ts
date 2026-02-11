import getCloudSqlConnection from "../getCloudSqlConnection";

const dismissActivityReview = async (
    activityId: string
): Promise<{ success: boolean }> => {
    const db = await getCloudSqlConnection();

    const result = await db.query(
        `
        UPDATE activities
        SET is_reviewed = TRUE
        WHERE id = $1
        `,
        [activityId]
    );

    return { success: result.rowCount !== null && result.rowCount > 0 };
};

export default dismissActivityReview;
