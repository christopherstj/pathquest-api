import { config } from "dotenv";
config();
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import getCloudSqlConnection from "./helpers/getCloudSqlConnection";

const fastify = Fastify({
    logger: true,
});

fastify.get("/", function (request, reply) {
    reply.send({ hello: "world" });
});

fastify.get("/peaks", async function (request, reply) {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.execute("SELECT * FROM Peak");

    return rows;
});

fastify.listen({ port: 8080, host: "0.0.0.0" }, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
});
