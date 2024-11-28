import { FastifyInstance } from "fastify";
import getActivityByPeak from "../helpers/activities/getActivitiesByPeak";
import { StravaCreds } from "../typeDefs/StravaCreds";
import updateStravaCreds from "../helpers/strava-creds/updateStravaCreds";
import getUser from "../helpers/user/getUser";
import createUser from "../helpers/user/createUser";
import addUserInterest from "../helpers/user/addUserInterest";

const auth = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: StravaCreds;
    }>("/strava-creds", async (request, reply) => {
        await updateStravaCreds(request.body);
        reply.code(200).send({ message: "Strava creds saved" });
    });

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

    fastify.post<{
        Body: {
            id: string;
            name: string;
            email: string | null;
            pic: string | null;
        };
    }>("/signup", async (request, reply) => {
        const { id, name, email, pic } = request.body;

        await createUser({ id, name, email });

        return { id, name, email, pic };
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
