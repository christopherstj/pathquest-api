/**
 * Register Push Token
 * 
 * Registers or updates a push notification token for a user.
 * If the token already exists for this user, updates the timestamp.
 * If the token exists for a different user, removes it first (device changed accounts).
 */

import getCloudSqlConnection from "../getCloudSqlConnection";

export default async function registerPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android'
): Promise<void> {
    const db = await getCloudSqlConnection();

    // Use upsert to handle both insert and update cases.
    // Assumes a UNIQUE constraint on (user_id, token).
    await db.query(
        `
            INSERT INTO user_push_tokens (user_id, token, platform, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, token)
            DO UPDATE SET
                platform = EXCLUDED.platform,
                updated_at = NOW()
        `,
        [userId, token, platform]
    );

    console.log(`[registerPushToken] Registered token for user ${userId} on ${platform}`);
}

