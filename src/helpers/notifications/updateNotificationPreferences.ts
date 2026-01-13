/**
 * Update Notification Preferences
 * 
 * Updates notification preferences for a user in user_settings.
 */

import getCloudSqlConnection from "../getCloudSqlConnection";

export interface NotificationPreferencesUpdate {
    summitNotificationsEnabled?: boolean;
}

export default async function updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreferencesUpdate
): Promise<void> {
    const { summitNotificationsEnabled } = preferences;

    // Only update fields that are provided
    if (summitNotificationsEnabled !== undefined) {
        const db = await getCloudSqlConnection();

        await db.query(
            `
                UPDATE user_settings
                SET summit_notifications_enabled = $1
                WHERE user_id = $2
            `,
            [summitNotificationsEnabled, userId]
        );
    }

    console.log(`[updateNotificationPreferences] Updated preferences for user ${userId}`);
}

