import { config } from "dotenv";
config();
import Fastify from "fastify";

const fastify = Fastify({
    logger: true,
});

fastify.get("/", function (request, reply) {
    reply.send({ hello: "world" });
});

fastify.get("/test", function (request, reply) {
    reply.send("This works!");
});

// Run the server!
// testing
fastify.listen({ port: 8080, host: "0.0.0.0" }, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
});
