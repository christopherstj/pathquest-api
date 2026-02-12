import { FastifyInstance } from "fastify";
import searchTrailheads from "../helpers/trails/searchTrailheads";

interface BboxQuery {
    nwLat: string;
    nwLng: string;
    seLat: string;
    seLng: string;
}

const trails = (fastify: FastifyInstance, _: any, done: any) => {
    // GET /api/trails/trailheads?nwLat=&nwLng=&seLat=&seLng=
    fastify.get<{ Querystring: BboxQuery }>(
        "/trailheads",
        async (request, reply) => {
            const { nwLat, nwLng, seLat, seLng } = request.query;
            if (!nwLat || !nwLng || !seLat || !seLng) {
                reply.code(400).send({ error: "Missing bbox params: nwLat, nwLng, seLat, seLng" });
                return;
            }
            const result = await searchTrailheads(
                parseFloat(nwLat),
                parseFloat(nwLng),
                parseFloat(seLat),
                parseFloat(seLng)
            );
            reply.code(200).send(result);
        }
    );

    done();
};

export default trails;
