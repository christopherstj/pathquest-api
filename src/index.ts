import { config } from "dotenv";
config();
import Fastify from "fastify";

const fastify = Fastify({
    logger: true,
});

fastify.get("/", function (request, reply) {
    reply.send({ hello: "world" });
});

// Run the server!
fastify.listen({ port: 8080, host: "0.0.0.0" }, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
});
