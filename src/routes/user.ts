import { FastifyInstance } from "fastify";
import getUser from "../helpers/user/getUser";
import getPublicUserProfile from "../helpers/user/getPublicUserProfile";
import getIsUserSubscribed from "../helpers/user/getIsUserSunscribed";
import deleteUser from "../helpers/user/deleteUser";
import getActivitiesProcessing from "../helpers/activities/getActivitiesProcessing";
import updateUser from "../helpers/user/updateUser";
import { ensureOwner } from "../helpers/authz";

export default async function user(
    fastify: FastifyInstance,
    _: any,
    done: any
) {
    fastify.get<{
        Params: {
            userId: string;
        };
    }>(
        "/:userId",
        { onRequest: [fastify.optionalAuth] },
        async (request, reply) => {
            const { userId } = request.params as { userId: string };
            const includePrivate = request.user?.id === userId;

            if (includePrivate) {
                const user = await getUser(userId);
                if (!user) {
                    reply.code(404).send("User not found");
                } else {
                    reply.code(200).send(user);
                }
                return;
            }

            const profile = await getPublicUserProfile(userId);

            if (!profile) {
                reply.code(404).send("Profile not found or not public");
            } else {
                reply.code(200).send(profile);
            }
        }
    );

    fastify.get<{
        Params: {
            userId: string;
        };
    }>(
        "/:userId/activities-processing",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { userId } = request.params as { userId: string };

            if (!ensureOwner(request, reply, userId)) {
                return;
            }

            const numProcessing = await getActivitiesProcessing(userId);
            if (numProcessing === undefined) {
                reply.code(404).send("User not found");
            } else {
                reply.code(200).send({ numProcessing });
            }
        }
    );

    fastify.get<{
        Params: {
            userId: string;
        };
    }>(
        "/:userId/is-subscribed",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { userId } = request.params;

            if (!ensureOwner(request, reply, userId)) {
                return;
            }

            try {
                const isSubscribed = await getIsUserSubscribed(userId);
                reply.code(200).send({ isSubscribed });
            } catch (error) {
                reply.code(500).send("Error checking subscription status");
            }
        }
    );

    fastify.delete<{
        Params: {
            userId: string;
        };
    }>(
        "/:userId",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { userId } = request.params;

            if (!ensureOwner(request, reply, userId)) {
                return;
            }

            try {
                await deleteUser(userId);
                reply
                    .code(200)
                    .send({ message: `User ${userId} deleted successfully` });
            } catch (error) {
                reply.code(500).send("Error deleting user");
            }
        }
    );

    fastify.put<{
        Params: {
            userId: string;
        };
        Body: {
            name?: string;
            email?: string;
            pic?: string;
        };
    }>(
        "/:userId",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { userId } = request.params;
            const { name, email, pic } = request.body;

            if (!ensureOwner(request, reply, userId)) {
                return;
            }

            try {
                await updateUser(userId, { name, email, pic });
                reply
                    .code(200)
                    .send({ message: `User ${userId} updated successfully` });
            } catch (error) {
                reply.code(500).send("Error updating user");
            }
        }
    );

    done();
}
