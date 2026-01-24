/**
 * Push Token Routes
 * 
 * API endpoints for managing push notification tokens.
 * 
 * POST /api/push-tokens - Register/update a push token
 * DELETE /api/push-tokens/:token - Unregister a push token
 * GET /api/push-tokens/preferences - Get notification preferences
 * PUT /api/push-tokens/preferences - Update notification preferences
 */

import { FastifyInstance } from "fastify";
import registerPushToken from "../helpers/notifications/registerPushToken";
import unregisterPushToken from "../helpers/notifications/unregisterPushToken";
import getNotificationPreferences from "../helpers/notifications/getNotificationPreferences";
import updateNotificationPreferences from "../helpers/notifications/updateNotificationPreferences";

interface RegisterTokenBody {
    token: string;
    platform: 'ios' | 'android';
}

interface UpdatePreferencesBody {
    summitNotificationsEnabled?: boolean;
}

export default async function pushTokens(
    fastify: FastifyInstance,
    _: any,
    done: any
) {
    /**
     * Register or update a push token for the authenticated user.
     */
    fastify.post<{
        Body: RegisterTokenBody;
    }>(
        "/",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const userId = request.user?.id;
            if (!userId) {
                return reply.code(401).send({ error: "Unauthorized" });
            }

            const { token, platform } = request.body;

            if (!token || typeof token !== 'string') {
                return reply.code(400).send({ error: "Token is required" });
            }

            if (!platform || !['ios', 'android'].includes(platform)) {
                return reply.code(400).send({ error: "Platform must be 'ios' or 'android'" });
            }

            try {
                await registerPushToken(userId, token, platform);
                reply.code(200).send({ success: true });
            } catch (error) {
                console.error("[push-tokens] Failed to register token:", error);
                reply.code(500).send({ error: "Failed to register push token" });
            }
        }
    );

    /**
     * Unregister a push token.
     */
    fastify.delete<{
        Params: { token: string };
    }>(
        "/:token",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const userId = request.user?.id;
            if (!userId) {
                return reply.code(401).send({ error: "Unauthorized" });
            }

            const { token } = request.params;

            if (!token) {
                return reply.code(400).send({ error: "Token is required" });
            }

            try {
                await unregisterPushToken(userId, token);
                reply.code(200).send({ success: true });
            } catch (error) {
                console.error("[push-tokens] Failed to unregister token:", error);
                reply.code(500).send({ error: "Failed to unregister push token" });
            }
        }
    );

    /**
     * Get notification preferences for the authenticated user.
     */
    fastify.get(
        "/preferences",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const userId = request.user?.id;
            if (!userId) {
                return reply.code(401).send({ error: "Unauthorized" });
            }

            try {
                const preferences = await getNotificationPreferences(userId);
                reply.code(200).send(preferences);
            } catch (error) {
                console.error("[push-tokens] Failed to get preferences:", error);
                reply.code(500).send({ error: "Failed to get notification preferences" });
            }
        }
    );

    /**
     * Update notification preferences for the authenticated user.
     */
    fastify.put<{
        Body: UpdatePreferencesBody;
    }>(
        "/preferences",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const userId = request.user?.id;
            if (!userId) {
                return reply.code(401).send({ error: "Unauthorized" });
            }

            const { summitNotificationsEnabled } = request.body;

            try {
                await updateNotificationPreferences(userId, {
                    summitNotificationsEnabled,
                });
                reply.code(200).send({ success: true });
            } catch (error) {
                console.error("[push-tokens] Failed to update preferences:", error);
                reply.code(500).send({ error: "Failed to update notification preferences" });
            }
        }
    );

    done();
}




