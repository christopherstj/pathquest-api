import getCloudSqlConnection from "../getCloudSqlConnection";

const getAscentOwnerId = async (ascentId: string): Promise<string | null> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT a.user_id FROM activities_peaks ap 
        LEFT JOIN activities a ON ap.activity_id = a.id
        WHERE ap.id = $1 LIMIT 1`,
            [ascentId]
        )
    ).rows as { user_id: string }[];

    if (rows.length === 0) {
        const rows2 = (
            await db.query(
                `SELECT user_id FROM user_peak_manual WHERE id = $1 LIMIT 1`,
                [ascentId]
            )
        ).rows as { user_id: string }[];

        if (rows2.length === 0) {
            return null;
        }

        return rows2[0].user_id;
    }

    return rows[0].user_id;
};

export default getAscentOwnerId;
