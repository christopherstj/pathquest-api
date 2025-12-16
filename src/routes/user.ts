import { FastifyInstance } from "fastify";
import getUser from "../helpers/user/getUser";
import getPublicUserProfile from "../helpers/user/getPublicUserProfile";
import getIsUserSubscribed from "../helpers/user/getIsUserSunscribed";
import deleteUser from "../helpers/user/deleteUser";
import getActivitiesProcessing from "../helpers/activities/getActivitiesProcessing";
import updateUser from "../helpers/user/updateUser";
import getUserPrivacy from "../helpers/user/getUserPrivacy";
import getUserProfileStats from "../helpers/user/getUserProfileStats";
import getUserAcceptedChallenges from "../helpers/user/getUserAcceptedChallenges";
import searchUserPeaks from "../helpers/peaks/searchUserPeaks";
import searchUserSummits from "../helpers/peaks/searchUserSummits";
import getPeakSummitsByUser from "../helpers/peaks/getPeakSummitsByUser";
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

    // Profile endpoint - aggregated user stats and accepted challenges
    fastify.get<{
        Params: {
            userId: string;
        };
    }>(
        "/:userId/profile",
        { onRequest: [fastify.optionalAuth] },
        async (request, reply) => {
            const { userId } = request.params;
            const isOwner = request.user?.id === userId;

            // Check user privacy - if not owner and user is private, return 404
            const isPublic = await getUserPrivacy(userId);
            if (isPublic === null) {
                reply.code(404).send({ message: "User not found" });
                return;
            }

            if (!isOwner && !isPublic) {
                reply.code(404).send({ message: "Profile not found" });
                return;
            }

            const includePrivate = isOwner;

            try {
                // Get user info
                const userInfo = includePrivate
                    ? await getUser(userId)
                    : await getPublicUserProfile(userId);

                if (!userInfo) {
                    reply.code(404).send({ message: "User not found" });
                    return;
                }

                // Get profile stats, accepted challenges, and peaks for map
                const [stats, acceptedChallenges, peaksForMap] = await Promise.all([
                    getUserProfileStats(userId, includePrivate),
                    getUserAcceptedChallenges(userId, includePrivate),
                    getPeakSummitsByUser(userId, includePrivate),
                ]);

                reply.code(200).send({
                    user: userInfo,
                    stats,
                    acceptedChallenges,
                    peaksForMap,
                    isOwner,
                });
            } catch (error) {
                console.error("Error fetching profile:", error);
                reply.code(500).send({ message: "Error fetching profile" });
            }
        }
    );

    // Search user's summited peaks
    fastify.get<{
        Params: {
            userId: string;
        };
        Querystring: {
            search?: string;
            page?: string;
            pageSize?: string;
        };
    }>(
        "/:userId/peaks",
        { onRequest: [fastify.optionalAuth] },
        async (request, reply) => {
            const { userId } = request.params;
            const { search, page, pageSize } = request.query;
            const isOwner = request.user?.id === userId;

            // Check user privacy
            const isPublic = await getUserPrivacy(userId);
            if (isPublic === null) {
                reply.code(404).send({ message: "User not found" });
                return;
            }

            if (!isOwner && !isPublic) {
                reply.code(404).send({ message: "Profile not found" });
                return;
            }

            const includePrivate = isOwner;

            try {
                const result = await searchUserPeaks(
                    userId,
                    includePrivate,
                    search,
                    page ? parseInt(page) : 1,
                    pageSize ? parseInt(pageSize) : 50
                );

                reply.code(200).send(result);
            } catch (error) {
                console.error("Error searching user peaks:", error);
                reply.code(500).send({ message: "Error searching peaks" });
            }
        }
    );

    // Search user's individual summits
    fastify.get<{
        Params: {
            userId: string;
        };
        Querystring: {
            search?: string;
            page?: string;
            pageSize?: string;
        };
    }>(
        "/:userId/summits",
        { onRequest: [fastify.optionalAuth] },
        async (request, reply) => {
            const { userId } = request.params;
            const { search, page, pageSize } = request.query;
            const isOwner = request.user?.id === userId;

            // Check user privacy
            const isPublic = await getUserPrivacy(userId);
            if (isPublic === null) {
                reply.code(404).send({ message: "User not found" });
                return;
            }

            if (!isOwner && !isPublic) {
                reply.code(404).send({ message: "Profile not found" });
                return;
            }

            const includePrivate = isOwner;

            try {
                const result = await searchUserSummits(
                    userId,
                    includePrivate,
                    search,
                    page ? parseInt(page) : 1,
                    pageSize ? parseInt(pageSize) : 50
                );

                reply.code(200).send(result);
            } catch (error) {
                console.error("Error searching user summits:", error);
                reply.code(500).send({ message: "Error searching summits" });
            }
        }
    );

    done();
}
