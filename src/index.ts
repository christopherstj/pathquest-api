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
import getChallenges from "./helpers/challenges/getChallenges";
import getPeakSummits from "./helpers/peaks/getPeakSummits";
import createUser from "./helpers/user/createUser";
import getNearestUnclimbedPeaks from "./helpers/peaks/getNearestUnclimbedPeaks";
import addFavoritePeak from "./helpers/peaks/addFavoritePeak";
import removeFavoritePeak from "./helpers/peaks/removeFavoritePeak";
import getFavoritePeaks from "./helpers/peaks/getFavoritePeaks";
import getUncompletedChallenges from "./helpers/challenges/getUncompletedChallenges";

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
    const { id, name, email, pic } = request.body;

    await createUser({ id, name, email });

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

fastify.post<{
    Body: {
        userId: string;
    };
}>("/peaks/summits", async function (request, reply) {
    const userId = request.body.userId;
    const peaks = await getPeakSummits(userId);
    reply.code(200).send(peaks);
});

fastify.post<{
    Body: {
        userId: string;
    };
}>("/peaks/summits/unclimbed", async function (request, reply) {
    const userId = request.body.userId;
    const peaks = await getNearestUnclimbedPeaks(userId);
    reply.code(200).send(peaks);
});

fastify.post<{
    Body: {
        userId: string;
    };
}>("/peaks/summits/favorite", async function (request, reply) {
    const userId = request.body.userId;
    const peaks = await getFavoritePeaks(userId);
    reply.code(200).send(peaks);
});

fastify.put<{
    Body: {
        newValue: boolean;
        userId: string;
        peakId: string;
    };
}>("/peaks/favorite", async function (request, reply) {
    const newValue = request.body.newValue;
    const userId = request.body.userId;
    const peakId = request.body.peakId;

    if (newValue === true) {
        await addFavoritePeak(peakId, userId);
    } else {
        await removeFavoritePeak(userId, peakId);
    }

    reply.code(200).send({ message: "Peak favorite added" });
});

fastify.post<{
    Body: {
        userId: string;
    };
}>("/challenges/incomplete", async function (request, reply) {
    const userId = request.body.userId;

    const challenges = await getUncompletedChallenges(userId);

    console.log(challenges);

    reply.code(200).send(challenges);
});

fastify.get<{
    Querystring: {
        page?: string;
        perPage?: string;
        search?: string;
    };
}>("/challenges", async function (request, reply) {
    const page = parseInt(request.query.page ?? "1");
    const perPage = parseInt(request.query.perPage ?? "25");
    const search = request.query.search;

    const challenges = await getChallenges(page, perPage, search);
    reply.code(200).send(challenges);
});

fastify.listen({ port: 8080, host: "0.0.0.0" }, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
});
