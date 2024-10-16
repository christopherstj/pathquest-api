import { config } from "dotenv";
config();
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import getCloudSqlConnection from "./helpers/getCloudSqlConnection";
import User from "./typeDefs/User";
import { RowDataPacket } from "mysql2";
import { StravaCreds } from "./typeDefs/StravaCreds";
import getUserHistoricalData from "./helpers/historical-data/getUserHistoricalData";
import updateStravaCreds from "./helpers/strava-creds/updateStravaCreds";
import getUser from "./helpers/user/getUser";
import getPeaks from "./helpers/peaks/getPeaks";

const fastify = Fastify({
    logger: true,
});

fastify.get("/", function (request, reply) {
    reply.send({ hello: "world" });
});

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

fastify.post<{
    Body: StravaCreds;
}>("/strava-creds", async (request, reply) => {
    await updateStravaCreds(request.body);
    reply.code(200).send({ message: "Strava creds saved" });
});

fastify.post<{
    Body: {
        id: string;
    };
}>("/user", async (request, reply) => {
    const user = await getUser(request.body.id);

    if (!user) {
        reply.code(200).send({ userFound: false });
    } else {
        reply.code(200).send({ userFound: true, user });
    }
});

fastify.post<{
    Body: {
        id: string;
        name: string;
        email: string | null;
        pic: string | null;
    };
}>("/signup", async (request, reply) => {
    const connection = await getCloudSqlConnection();

    const { id, name, email, pic } = request.body;

    await connection.execute(
        "INSERT INTO User (id, name, email, pic) VALUES (?, ?, ?, ?)",
        [id, name, email, pic]
    );

    return { id, name, email, pic };
});

fastify.get<{
    Querystring: {
        page?: string;
        perPage?: string;
        search?: string;
    };
}>("/peaks", async function (request, reply) {
    const page = parseInt(request.query.page ?? "1");
    const perPage = parseInt(request.query.perPage ?? "25");
    const search = request.query.search;

    const peaks = await getPeaks(page, perPage, search);
    reply.code(200).send(peaks);
});

fastify.listen({ port: 8080, host: "0.0.0.0" }, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
});
