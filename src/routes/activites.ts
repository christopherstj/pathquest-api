import { FastifyInstance } from "fastify";
import getActivityByPeak from "../helpers/activities/getActivitiesByPeak";

const activites = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: {
            userId: string;
            peakId: string;
        };
    }>("/activities/peak", async function (request, reply) {
        const userId = request.body.userId;
        const peakId = request.body.peakId;

        const activities = await getActivityByPeak(peakId, userId);

        reply.code(200).send(activities);
    });

    done();
};

export default activites;
