/**
 * Send Summit Notification
 * 
 * Sends a push notification to a user when they log a summit.
 * Uses Expo Push Notification API.
 */

import getCloudSqlConnection from "../getCloudSqlConnection";
import getNotificationPreferences from "./getNotificationPreferences";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface SummitNotificationData {
    userId: string;
    peakId: string;
    peakName: string;
    summitDate: string;
    summitId?: string;
}

interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: 'default' | null;
    badge?: number;
}

/**
 * Send push notifications for a summit log.
 * 
 * @param data - Summit notification data
 * @returns Number of notifications sent successfully
 */
export default async function sendSummitNotification(
    data: SummitNotificationData
): Promise<number> {
    const { userId, peakId, peakName, summitDate, summitId } = data;

    // Check if user has summit notifications enabled
    const preferences = await getNotificationPreferences(userId);
    if (!preferences.summitNotificationsEnabled) {
        console.log(`[sendSummitNotification] User ${userId} has summit notifications disabled`);
        return 0;
    }

    const db = await getCloudSqlConnection();

    // Get user's push tokens
    const tokensResult = await db.query(
        `
            SELECT token, platform
            FROM user_push_tokens
            WHERE user_id = $1
        `,
        [userId]
    );
    const tokens: { token: string; platform: string }[] = tokensResult.rows;

    if (tokens.length === 0) {
        console.log(`[sendSummitNotification] No push tokens for user ${userId}`);
        return 0;
    }

    // Format the date for display
    const dateStr = new Date(summitDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    // Build notification messages
    const messages: ExpoPushMessage[] = tokens.map((t) => ({
        to: t.token,
        title: "Summit Logged!",
        body: `You've logged ${peakName} - ${dateStr}`,
        data: {
            type: 'summit_logged',
            peakId,
            summitId,
        },
        sound: 'default',
    }));

    // Send notifications via Expo Push API
    try {
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        if (!response.ok) {
            console.error(`[sendSummitNotification] Expo Push API error: ${response.status}`);
            return 0;
        }

        const result = await response.json();
        
        // Check for errors and remove invalid tokens
        if (result.data) {
            for (let i = 0; i < result.data.length; i++) {
                const ticket = result.data[i];
                if (ticket.status === 'error') {
                    console.error(`[sendSummitNotification] Push error:`, ticket.message);
                    
                    // Remove invalid tokens
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        await db.query(
                            `
                                DELETE FROM user_push_tokens
                                WHERE token = $1
                            `,
                            [tokens[i].token]
                        );
                        console.log(`[sendSummitNotification] Removed invalid token`);
                    }
                }
            }
        }

        const successCount = result.data?.filter((t: any) => t.status === 'ok').length ?? 0;
        console.log(`[sendSummitNotification] Sent ${successCount}/${tokens.length} notifications for user ${userId}`);
        
        return successCount;
    } catch (error) {
        console.error(`[sendSummitNotification] Failed to send notifications:`, error);
        return 0;
    }
}

