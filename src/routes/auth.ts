import { FastifyInstance } from "fastify";
import { StravaCreds } from "../typeDefs/StravaCreds";
import updateStravaCreds from "../helpers/updateStravaCreds";
import getUser from "../helpers/user/getUser";
import addUserData from "../helpers/user/addUserData";
import addUserInterest from "../helpers/user/addUserInterest";
import createUser from "../helpers/user/createUser";

const auth = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: StravaCreds;
    }>(
        "/strava-creds",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { body } = request;

            if (!request.user?.id || body.provider_account_id !== request.user.id) {
                reply.code(403).send({ message: "Forbidden" });
                return;
            }

            await updateStravaCreds(body);
            reply.code(200).send({ message: "Strava creds saved" });
        }
    );

    fastify.post<{
        Body: {
            id: string;
            name: string;
            email: string | null;
            pic: string | null;
            stravaCreds: StravaCreds;
        };
    }>("/signup", async (request, reply) => {
        const { id, name, email, pic, stravaCreds } = request.body;

        await createUser({ id, name, email });
        await updateStravaCreds(stravaCreds);

        const newUser = await addUserData({
            id,
            name,
            email,
            token: stravaCreds.access_token,
        });

        reply.code(200).send({ user: newUser });
    });

    fastify.post<{
        Body: {
            email: string;
        };
    }>("/user-interest", async (request, reply) => {
        const { email } = request.body;

        await addUserInterest(email);

        reply.code(200).send({ message: "User interest added" });
    });

    done();
};

export default auth;
