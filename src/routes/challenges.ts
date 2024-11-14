import { FastifyInstance } from "fastify";
import getUncompletedChallenges from "../helpers/challenges/getUncompletedChallenges";
import getChallenges from "../helpers/challenges/getChallenges";
import getChallengeById from "../helpers/challenges/getChallengeById";
import getPeaksByChallenge from "../helpers/challenges/getPeaksByChallenge";
import getMostRecentSummitByPeak from "../helpers/peaks/getMostRecentSummitByPeak";
import getAllChallenges from "../helpers/challenges/getAllChallenges";

const challenges = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: {
            userId: string;
        };
    }>("/challenges/incomplete", async function (request, reply) {
        const userId = request.body.userId;

        const challenges = await getUncompletedChallenges(userId);

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

    fastify.get<{
        Querystring: {
            userId: string;
        };
        Params: {
            challengeId: string;
        };
    }>("/challenges/:challengeId/details", async function (request, reply) {
        const challengeId = parseInt(request.params.challengeId);
        const userId = request.query.userId;

        const challenge = await getChallengeById(challengeId);

        const peaks = await getPeaksByChallenge(challengeId, userId);

        if (peaks) {
            const data = await getMostRecentSummitByPeak(peaks, userId);

            reply.code(200).send({
                challenge,
                peaks: data,
            });
        } else {
            reply.code(200).send([]);
        }
    });

    fastify.get<{
        Querystring: {
            userId: string;
            type: string;
            northWestLat?: string;
            northWestLng?: string;
            southEastLat?: string;
            southEastLng?: string;
            search?: string;
        };
    }>("/challenges/search", async function (request, reply) {
        const {
            userId,
            type,
            northWestLat,
            northWestLng,
            southEastLat,
            southEastLng,
            search,
        } = request.query;

        const bounds =
            northWestLat && northWestLng && southEastLat && southEastLng
                ? {
                      northWest: {
                          lat: parseFloat(northWestLat),
                          lng: parseFloat(northWestLng),
                      },
                      southEast: {
                          lat: parseFloat(southEastLat),
                          lng: parseFloat(southEastLng),
                      },
                  }
                : undefined;

        const challenges = await getAllChallenges(
            userId,
            type as "completed" | "in-progress" | "not-started",
            bounds,
            search
        );
        reply.code(200).send(challenges);
    });

    done();
};

export default challenges;
