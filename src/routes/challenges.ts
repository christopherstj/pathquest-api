import { FastifyInstance } from "fastify";
import getUncompletedChallenges from "../helpers/challenges/getUncompletedChallenges";
import getChallenges from "../helpers/challenges/getChallenges";
import getChallengeById from "../helpers/challenges/getChallengeById";
import getPeaksByChallenge from "../helpers/challenges/getPeaksByChallenge";
import getMostRecentSummitByPeak from "../helpers/peaks/getMostRecentSummitByPeak";
import getAllChallenges from "../helpers/challenges/getAllChallenges";
import UserChallengeFavorite from "../typeDefs/UserChallengeFavorite";
import getUserPrivacy from "../helpers/user/getUserPrivacy";
import addChallengeFavorite from "../helpers/challenges/addChallengeFavorite";
import deleteChallengeFavorite from "../helpers/challenges/deleteChallengeFavorite";
import updateChallengePrivacy from "../helpers/challenges/updateChallengePrivacy";
import getChallengeByUserAndId from "../helpers/challenges/getChallengeByUserAndId";

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

        const challenge = await getChallengeByUserAndId(challengeId, userId);

        const peaks = await getPeaksByChallenge(challengeId, userId);

        if (peaks) {
            const data = await getMostRecentSummitByPeak(peaks, userId);

            reply.code(200).send({
                challenge,
                ...data,
            });
        } else {
            reply.code(200).send();
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
            favoritesOnly?: string;
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
            favoritesOnly,
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

        const types = type.split(",") as (
            | "completed"
            | "in-progress"
            | "not-started"
        )[];

        const challenges = await getAllChallenges(
            userId,
            types,
            bounds,
            search,
            !!favoritesOnly && favoritesOnly === "true"
        );
        reply.code(200).send(challenges);
    });

    fastify.post<{
        Body: {
            userId: string;
            challengeId: string;
        };
    }>("/challenges/favorite", async (request, reply) => {
        const { userId, challengeId } = request.body;

        const privacy = await getUserPrivacy(userId);

        if (privacy === null) {
            reply.code(400).send({
                message: "User not found",
            });
            return;
        }

        await addChallengeFavorite({
            userId,
            challengeId,
            isPublic: privacy,
        });

        reply.code(200).send();
    });

    fastify.put<{
        Body: UserChallengeFavorite;
    }>("/challenges/favorite", async (request, reply) => {
        const { userId, challengeId, isPublic } = request.body;

        console.log(
            `Updating favorite for user ${userId} and challenge ${challengeId} to public: ${isPublic}`
        );

        await updateChallengePrivacy(userId, challengeId, isPublic);

        reply.code(200).send();
    });

    fastify.delete<{
        Params: {
            userId: string;
            challengeId: string;
        };
    }>("/challenges/favorite/:userId/:challengeId", async (request, reply) => {
        const { userId, challengeId } = request.params;

        await deleteChallengeFavorite(userId, challengeId);

        reply.code(200).send();
    });

    done();
};

export default challenges;
