import { FastifyInstance } from "fastify";
import getFireDetail from "../helpers/fires/getFireDetail";

export default async function (fastify: FastifyInstance) {
    // GET /api/fires/:incidentId
    fastify.get<{
        Params: { incidentId: string };
    }>(
        "/:incidentId",
        async (request, reply) => {
            const detail = await getFireDetail(request.params.incidentId);
            if (!detail) {
                reply.code(404).send({ message: "Fire not found" });
                return;
            }
            reply.code(200).send(detail);
        }
    );
}
