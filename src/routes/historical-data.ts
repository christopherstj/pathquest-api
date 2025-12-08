import { FastifyInstance } from "fastify";
import getUserHistoricalData from "../helpers/historical-data/getUserHistoricalData";
import { ensureOwner } from "../helpers/authz";

const historicalData = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: {
            userId: string;
        };
    }>(
        "/",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { userId } = request.body;

            if (!ensureOwner(request, reply, userId)) {
                return;
            }

            getUserHistoricalData(userId);

            reply.code(200).send({ message: "Processing historical data" });
        }
    );

    done();
};

export default historicalData;
