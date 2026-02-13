import { FastifyInstance } from "fastify";
import getSnowPoint from "../helpers/snow/getSnowPoint";

export default async function (fastify: FastifyInstance) {
    // GET /api/snow/point?lat=X&lng=Y
    fastify.get<{
        Querystring: { lat: string; lng: string };
    }>(
        "/point",
        async (request, reply) => {
            const lat = parseFloat(request.query.lat);
            const lng = parseFloat(request.query.lng);

            if (isNaN(lat) || isNaN(lng)) {
                reply.code(400).send({
                    message: "lat and lng query parameters are required and must be numbers",
                });
                return;
            }

            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                reply.code(400).send({
                    message: "lat must be between -90 and 90, lng between -180 and 180",
                });
                return;
            }

            try {
                const result = await getSnowPoint(lat, lng);
                reply.code(200).send(result);
            } catch (error: any) {
                fastify.log.error(error, "Failed to fetch snow data from NOHRSC");
                reply.code(502).send({
                    message: "Failed to fetch snow data from NOHRSC",
                });
            }
        }
    );
}
