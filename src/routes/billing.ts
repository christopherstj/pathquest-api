import { FastifyInstance } from "fastify";
import createSubscription from "../helpers/billing/createSubscription";
import deleteSubscription from "../helpers/billing/deleteSubscription";

const billing = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: {
            userId: string;
            email: string | null;
            stripeUserId: string | null;
        };
    }>("/billing/create-subscription", async (request, reply) => {
        const { userId, email, stripeUserId } = request.body;

        if (!stripeUserId) {
            reply.code(400).send();
        }

        await createSubscription(userId, email, stripeUserId);

        reply.code(200).send({ message: "Subscription created" });
    });

    fastify.post<{
        Body: {
            stripeUserId?: string;
        };
    }>("/billing/delete-subscription", async (request, reply) => {
        const { stripeUserId } = request.body;

        if (!stripeUserId) {
            reply.code(400).send();
        }

        await deleteSubscription(stripeUserId ?? null);

        reply.code(200).send({ message: "Subscription deleted" });
    });

    done();
};

export default billing;
