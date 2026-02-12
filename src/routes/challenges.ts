import { FastifyInstance } from "fastify";
import getUncompletedChallenges from "../helpers/challenges/getUncompletedChallenges";
import getChallenges from "../helpers/challenges/getChallenges";
import getPeaksByChallenge from "../helpers/challenges/getPeaksByChallenge";
import getMostRecentSummitByPeak from "../helpers/peaks/getMostRecentSummitByPeak";
import getAllChallenges from "../helpers/challenges/getAllChallenges";
import UserChallengeFavorite from "../typeDefs/UserChallengeFavorite";
import getUserPrivacy from "../helpers/user/getUserPrivacy";
import addChallengeFavorite from "../helpers/challenges/addChallengeFavorite";
import deleteChallengeFavorite from "../helpers/challenges/deleteChallengeFavorite";
import updateChallengePrivacy from "../helpers/challenges/updateChallengePrivacy";
import getChallengeByUserAndId from "../helpers/challenges/getChallengeByUserAndId";
import getChallengeProgress from "../helpers/challenges/getChallengeProgress";
import getNextPeakSuggestion from "../helpers/challenges/getNextPeakSuggestion";
import getChallengeActivity from "../helpers/challenges/getChallengeActivity";
import getPopularChallenges from "../helpers/challenges/getPopularChallenges";
import aggregateAreaConditions from "../helpers/conditions/aggregateAreaConditions";
import getCloudSqlConnection from "../helpers/getCloudSqlConnection";
import { ensureOwner } from "../helpers/authz";

const challenges = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.post<{
        Body: {
            userId: string;
        };
    }>(
        "/incomplete",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const challenges = await getUncompletedChallenges(userId);

            reply.code(200).send(challenges);
        }
    );

    fastify.get<{
        Querystring: {
            page?: string;
            perPage?: string;
            search?: string;
        };
    }>("/", async function (request, reply) {
        const page = parseInt(request.query.page ?? "1");
        const perPage = parseInt(request.query.perPage ?? "25");
        const search = request.query.search;

        const challenges = await getChallenges(page, perPage, search);
        reply.code(200).send(challenges);
    });

    // Get "popular" challenges (hybrid ranking). Public endpoint; does not expose popularity counts.
    fastify.get<{
        Querystring: {
            limit?: string;
        };
    }>("/popular", async function (request, reply) {
        const limit = parseInt(request.query.limit ?? "5");
        const safeLimit = Number.isFinite(limit)
            ? Math.max(1, Math.min(limit, 25))
            : 5;

        const challenges = await getPopularChallenges(safeLimit);
        reply.code(200).send(challenges);
    });

    fastify.get<{
        Params: {
            challengeId: string;
        };
    }>(
        "/:challengeId/details",
        { onRequest: [fastify.optionalAuth] },
        async function (request, reply) {
            const challengeId = parseInt(request.params.challengeId);
            const userId = request.user?.id ?? "";

            const challenge = await getChallengeByUserAndId(challengeId, userId);

            const peaks = await getPeaksByChallenge(challengeId, userId);

            // Get progress info including last progress date
            const progress = userId 
                ? await getChallengeProgress(challengeId, userId)
                : { total: 0, completed: 0, lastProgressDate: null, lastProgressCount: 0 };

            if (peaks) {
                const data = await getMostRecentSummitByPeak(peaks, userId);

                reply.code(200).send({
                    challenge,
                    progress,
                    ...data,
                });
            } else {
                reply.code(200).send({
                    challenge,
                    progress,
                });
            }
        }
    );

    // Get next peak suggestion for a challenge
    fastify.get<{
        Params: {
            challengeId: string;
        };
        Querystring: {
            lat?: string;
            lng?: string;
        };
    }>(
        "/:challengeId/next-peak",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const challengeId = parseInt(request.params.challengeId);
            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const lat = request.query.lat ? parseFloat(request.query.lat) : undefined;
            const lng = request.query.lng ? parseFloat(request.query.lng) : undefined;

            const suggestion = await getNextPeakSuggestion(challengeId, userId, lat, lng);
            reply.code(200).send(suggestion);
        }
    );

    // Get community activity for a challenge
    fastify.get<{
        Params: {
            challengeId: string;
        };
    }>(
        "/:challengeId/activity",
        { onRequest: [fastify.optionalAuth] },
        async function (request, reply) {
            const challengeId = parseInt(request.params.challengeId);

            const activity = await getChallengeActivity(challengeId);
            reply.code(200).send(activity);
        }
    );

    fastify.get<{
        Querystring: {
            type: string;
            northWestLat?: string;
            northWestLng?: string;
            southEastLat?: string;
            southEastLng?: string;
            search?: string;
            favoritesOnly?: string;
        };
    }>(
        "/search",
        { onRequest: [fastify.optionalAuth] },
        async function (request, reply) {
            const {
                type,
                northWestLat,
                northWestLng,
                southEastLat,
                southEastLng,
                search,
                favoritesOnly,
            } = request.query;

            const userId = request.user?.id ?? "";

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

            const onlyFavorites = favoritesOnly === "true";
            if (onlyFavorites && !userId) {
                reply.code(401).send({ message: "Auth required for favorites" });
                return;
            }

            const challenges = await getAllChallenges(
                userId,
                types,
                bounds,
                search,
                onlyFavorites
            );
            reply.code(200).send(challenges);
        }
    );

    fastify.post<{
        Body: {
            challengeId: string;
        };
    }>(
        "/favorite",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { challengeId } = request.body;
            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const privacy = await getUserPrivacy(userId);

            if (privacy === null) {
                reply.code(400).send({
                    message: "User not found",
                });
                return;
            }

            await addChallengeFavorite({
                user_id: userId,
                challenge_id: challengeId,
                is_public: privacy,
            });

            reply.code(200).send();
        }
    );

    fastify.put<{
        Body: UserChallengeFavorite;
    }>(
        "/favorite",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { user_id, challenge_id, is_public } = request.body;

            if (!ensureOwner(request, reply, user_id)) {
                return;
            }

            await updateChallengePrivacy(user_id, challenge_id, is_public);

            reply.code(200).send();
        }
    );

    fastify.delete<{
        Params: {
            challengeId: string;
        };
    }>(
        "/favorite/:challengeId",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const { challengeId } = request.params;
            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            await deleteChallengeFavorite(userId, challengeId);

            reply.code(200).send();
        }
    );

    // GET /api/challenges/:challengeId/conditions
    fastify.get<{
        Params: { challengeId: string };
    }>(
        "/:challengeId/conditions",
        async function (request, reply) {
            const challengeId = parseInt(request.params.challengeId);
            if (isNaN(challengeId)) {
                reply.code(400).send({ message: "Invalid challenge ID" });
                return;
            }

            const db = await getCloudSqlConnection();
            const peaksResult = await db.query(
                `SELECT peak_id FROM peaks_challenges WHERE challenge_id = $1`,
                [challengeId]
            );

            const peakIds = peaksResult.rows.map((r: any) => r.peak_id);
            const summary = await aggregateAreaConditions(peakIds);

            reply.code(200).send({ challengeId, ...summary });
        }
    );

    done();
};

export default challenges;
