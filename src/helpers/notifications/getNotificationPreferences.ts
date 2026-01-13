/**
 * Get Notification Preferences
 * 
 * Retrieves notification preferences for a user from user_settings.
 */

import getCloudSqlConnection from "../getCloudSqlConnection";

export interface NotificationPreferences {
    summitNotificationsEnabled: boolean;
}

export default async function getNotificationPreferences(
    userId: string
): Promise<NotificationPreferences> {
    const db = await getCloudSqlConnection();

    const result = await db.query(
        `
            SELECT summit_notifications_enabled
            FROM user_settings
            WHERE user_id = $1
        `,
        [userId]
    );

    if (result.rows.length === 0) {
        // Return defaults if no settings exist
        return {
            summitNotificationsEnabled: true,
        };
    }

    return {
        summitNotificationsEnabled:
            result.rows[0].summit_notifications_enabled ?? true,
    };
}

