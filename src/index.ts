import { config } from "dotenv";
config();
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import getCloudSqlConnection from "./helpers/getCloudSqlConnection";
import User from "./typeDefs/User";
import { RowDataPacket } from "mysql2";
import { StravaCreds } from "./typeDefs/StravaCreds";
import getUserHistoricalData from "./helpers/historical-data/getUserHistoricalData";

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
    const connection = await getCloudSqlConnection();

    const { providerAccountId, access_token, refresh_token, expires_at } =
        request.body;

    await connection.execute(
        "INSERT INTO StravaToken (userId, accessToken, refreshToken, accessTokenExpiresAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE accessToken = ?, refreshToken = ?, accessTokenExpiresAt = ?",
        [
            providerAccountId,
            access_token,
            refresh_token,
            expires_at,
            access_token,
            refresh_token,
            expires_at,
        ]
    );

    reply.code(200).send({ message: "Strava creds saved" });
});

fastify.post<{
    Body: {
        id: string;
    };
}>("/user", async (request, reply) => {
    const connection = await getCloudSqlConnection();

    const { id } = request.body;

    const [rows] = await connection.query<(User & RowDataPacket)[]>(
        "SELECT * FROM User WHERE id = ? LIMIT 1",
        [id]
    );

    const user = rows[0];

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
