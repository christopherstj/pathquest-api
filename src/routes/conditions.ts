import { FastifyInstance } from "fastify";
import getSnotelStationDetail from "../helpers/conditions/getSnotelStationDetail";
import getStreamGaugeDetail from "../helpers/conditions/getStreamGaugeDetail";
import getAqiSiteDetail from "../helpers/conditions/getAqiSiteDetail";
import getAvalancheZoneDetail from "../helpers/conditions/getAvalancheZoneDetail";

export default async function (fastify: FastifyInstance) {
    // GET /api/conditions/snotel/:stationId?history=30d|90d|1y
    fastify.get<{
        Params: { stationId: string };
        Querystring: { history?: string };
    }>(
        "/snotel/:stationId",
        async (request, reply) => {
            const detail = await getSnotelStationDetail(
                request.params.stationId,
                request.query.history
            );
            if (!detail) {
                reply.code(404).send({ message: "SNOTEL station not found" });
                return;
            }
            reply.code(200).send(detail);
        }
    );

    // GET /api/conditions/streamflow/:siteId?history=30d|90d|1y
    fastify.get<{
        Params: { siteId: string };
        Querystring: { history?: string };
    }>(
        "/streamflow/:siteId",
        async (request, reply) => {
            const detail = await getStreamGaugeDetail(
                request.params.siteId,
                request.query.history
            );
            if (!detail) {
                reply.code(404).send({ message: "Stream gauge not found" });
                return;
            }
            reply.code(200).send(detail);
        }
    );

    // GET /api/conditions/aqi/:siteId?history=30d|90d|1y
    fastify.get<{
        Params: { siteId: string };
        Querystring: { history?: string };
    }>(
        "/aqi/:siteId",
        async (request, reply) => {
            const detail = await getAqiSiteDetail(
                request.params.siteId,
                request.query.history
            );
            if (!detail) {
                reply.code(404).send({ message: "AQI site not found" });
                return;
            }
            reply.code(200).send(detail);
        }
    );

    // GET /api/conditions/avalanche/:centerId/:zoneId
    fastify.get<{
        Params: { centerId: string; zoneId: string };
    }>(
        "/avalanche/:centerId/:zoneId",
        { preHandler: [fastify.optionalAuth] },
        async (request, reply) => {
            const userId = (request as any).user?.id;
            const detail = await getAvalancheZoneDetail(
                request.params.centerId,
                request.params.zoneId,
                userId
            );
            if (!detail) {
                reply.code(404).send({ message: "Avalanche zone not found" });
                return;
            }
            reply.code(200).send(detail);
        }
    );
}
