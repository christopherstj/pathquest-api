import { FastifyInstance } from "fastify";
import getUserHistoricalData from "../helpers/historical-data/getUserHistoricalData";

const historicalData = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: {
            userId: string;
        };
    }>("/historical-data", async (request, reply) => {
        const { userId } = request.body;

        console.log("Processing historical data for", userId);

        getUserHistoricalData(userId);

        reply.code(200).send({ message: "Processing historical data" });
    });

    done();
};

export default historicalData;
