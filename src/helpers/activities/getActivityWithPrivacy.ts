import getCloudSqlConnection from "../getCloudSqlConnection";

interface ActivityPrivacyInfo {
    activityId: string;
    ownerId: string;
    isActivityPublic: boolean;
    isUserPublic: boolean;
}

/**
 * Get activity privacy information to determine access rights.
 * Returns null if activity doesn't exist.
 */
const getActivityWithPrivacy = async (
    activityId: string
): Promise<ActivityPrivacyInfo | null> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query<{
            id: string;
            user_id: string;
            is_public: boolean;
            user_is_public: boolean;
        }>(
            `SELECT 
                a.id,
                a.user_id,
                COALESCE(a.is_public, true) as is_public,
                COALESCE(u.is_public, true) as user_is_public
            FROM activities a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = $1
            LIMIT 1`,
            [activityId]
        )
    ).rows;

    if (rows.length === 0) {
        return null;
    }

    return {
        activityId: rows[0].id,
        ownerId: rows[0].user_id,
        isActivityPublic: rows[0].is_public,
        isUserPublic: rows[0].user_is_public,
    };
};

export default getActivityWithPrivacy;

