import { FastifyInstance } from "fastify";
import createSubscription from "../helpers/billing/createSubscription";
import deleteSubscription from "../helpers/billing/deleteSubscription";
import { ensureOwner } from "../helpers/authz";

const billing = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: {
            userId: string;
            email: string | null;
            stripeUserId: string | null;
        };
    }>(
        "/create-subscription",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { userId, email, stripeUserId } = request.body;

            if (!ensureOwner(request, reply, userId)) {
                return;
            }

            if (!stripeUserId) {
                reply.code(400).send({ message: "stripeUserId is required" });
                return;
            }

            await createSubscription(userId, email, stripeUserId);

            reply.code(200).send({ message: "Subscription created" });
        }
    );

    fastify.post<{
        Body: {
            userId: string;
            stripeUserId?: string;
        };
    }>(
        "/delete-subscription",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { stripeUserId, userId } = request.body;

            if (!ensureOwner(request, reply, userId)) {
                return;
            }

            if (!stripeUserId) {
                reply.code(400).send({ message: "stripeUserId is required" });
                return;
            }

            await deleteSubscription(stripeUserId ?? null);

            reply.code(200).send({ message: "Subscription deleted" });
        }
    );

    done();
};

export default billing;
