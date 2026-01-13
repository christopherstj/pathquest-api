/**
 * Unregister Push Token
 * 
 * Removes a push notification token for a user.
 * Called when user logs out or disables notifications.
 */

import getCloudSqlConnection from "../getCloudSqlConnection";

export default async function unregisterPushToken(
    userId: string,
    token: string
): Promise<void> {
    const db = await getCloudSqlConnection();

    await db.query(
        `
            DELETE FROM user_push_tokens
            WHERE user_id = $1 AND token = $2
        `,
        [userId, token]
    );

    console.log(`[unregisterPushToken] Removed token for user ${userId}`);
}

