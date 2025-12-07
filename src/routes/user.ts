import { FastifyInstance } from "fastify";
import getUser from "../helpers/user/getUser";
import getPublicUserProfile from "../helpers/user/getPublicUserProfile";
import getIsUserSubscribed from "../helpers/user/getIsUserSunscribed";
import deleteUser from "../helpers/user/deleteUser";
import getActivitiesProcessing from "../helpers/activities/getActivitiesProcessing";
import updateUser from "../helpers/user/updateUser";

export default async function user(
    fastify: FastifyInstance,
    _: any,
    done: any
) {
    // NOT USED - remove?
    fastify.post<{
        Body: {
            id: string;
        };
    }>("/user", async (request, reply) => {
        const user = await getUser(request.body.id);

        if (!user) {
            reply.code(200).send({ userFound: false });
        } else {
            reply.code(200).send({ userFound: true, user });
        }
    });

    fastify.get<{
        Params: {
            userId: string;
        };
        Querystring: {
            requestingUserId?: string;
        };
    }>("/user/:userId", async (request, reply) => {
        const { userId } = request.params as { userId: string };
        const requestingUserId = request.query.requestingUserId ?? "";

        const includePrivate = requestingUserId === userId;

        if (includePrivate) {
            const user = await getUser(userId);
            if (!user) {
                reply.code(404).send("User not found");
            } else {
                reply.code(200).send(user);
            }
        } else {
            const profile = await getPublicUserProfile(userId);

            if (!profile) {
                reply.code(404).send("Profile not found or not public");
            } else {
                reply.code(200).send(profile);
            }
        }
    });

    fastify.get<{
        Params: {
            userId: string;
        };
        Querystring: {
            requestingUserId?: string;
        };
    }>("/user/:userId/activities-processing", async (request, reply) => {
        const { userId } = request.params as { userId: string };
        const requestingUserId = request.query.requestingUserId;

        const allowed = requestingUserId === userId;

        if (allowed) {
            const numProcessing = await getActivitiesProcessing(userId);
            if (numProcessing === undefined) {
                reply.code(404).send("User not found");
            } else {
                reply.code(200).send({ numProcessing });
            }
        } else {
            reply.code(403).send("Forbidden");
        }
    });

    fastify.get<{
        Params: {
            userId: string;
        };
    }>("/user/:userId/is-subscribed", async (request, reply) => {
        const { userId } = request.params;

        try {
            const isSubscribed = await getIsUserSubscribed(userId);
            reply.code(200).send({ isSubscribed });
        } catch (error) {
            reply.code(500).send("Error checking subscription status");
        }
    });

    fastify.delete<{
        Params: {
            userId: string;
        };
    }>("/user/:userId", async (request, reply) => {
        const { userId } = request.params;

        try {
            await deleteUser(userId);
            reply
                .code(200)
                .send({ message: `User ${userId} deleted successfully` });
        } catch (error) {
            reply.code(500).send("Error deleting user");
        }
    });

    fastify.put<{
        Params: {
            userId: string;
        };
        Body: {
            name?: string;
            email?: string;
            pic?: string;
        };
    }>("/user/:userId", async (request, reply) => {
        const { userId } = request.params;
        const { name, email, pic } = request.body;

        try {
            await updateUser(userId, { name, email, pic });
            reply
                .code(200)
                .send({ message: `User ${userId} updated successfully` });
        } catch (error) {
            reply.code(500).send("Error updating user");
        }
    });

    done();
}
