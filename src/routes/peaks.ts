import { FastifyInstance } from "fastify";
import getPeaks from "../helpers/peaks/getPeaks";
import getPeakById from "../helpers/peaks/getPeakById";
import getActivityByPeak from "../helpers/activities/getActivitiesByPeak";
import getSummitsByPeak from "../helpers/peaks/getSummitsByPeak";
import getPeakSummits from "../helpers/peaks/getPeakSummits";
import getNearestUnclimbedPeaks from "../helpers/peaks/getNearestUnclimbedPeaks";
import getUnclimbedPeaks from "../helpers/peaks/getUnclimbedPeaks";
import getFavoritePeaks from "../helpers/peaks/getFavoritePeaks";
import addFavoritePeak from "../helpers/peaks/addFavoritePeak";
import removeFavoritePeak from "../helpers/peaks/removeFavoritePeak";
import getIsPeakFavorited from "../helpers/peaks/getIsPeakFavorited";

const peaks = (fastify: FastifyInstance, _: any, done: any) => {
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

    fastify.get<{
        Params: {
            id: string;
        };
        Querystring: {
            userId: string;
        };
    }>("/peaks/details/:id", async function (request, reply) {
        const peakId = request.params.id;
        const userId = request.query.userId;

        const peak = await getPeakById(peakId, userId);

        if (peak?.isSummitted) {
            const activities = await getActivityByPeak(peakId, userId);
            const summits = await getSummitsByPeak(peakId, userId);
            reply.code(200).send({ peak, activities, summits });
        } else {
            reply.code(200).send({ peak, activities: [], summits: [] });
        }
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

    fastify.get<{
        Querystring: {
            userId: string;
        };
    }>("/peaks/summits/unclimbed/nearest", async function (request, reply) {
        const userId = request.query.userId;
        const peaks = await getNearestUnclimbedPeaks(userId);
        reply.code(200).send(peaks);
    });

    fastify.get<{
        Querystring: {
            userId: string;
            northWestLat?: string;
            northWestLng?: string;
            southEastLat?: string;
            southEastLng?: string;
            search?: string;
            showSummittedPeaks?: string;
        };
    }>("/peaks/summits/unclimbed", async function (request, reply) {
        const {
            userId,
            northWestLat,
            northWestLng,
            southEastLat,
            southEastLng,
            search,
        } = request.query;
        const showSummittedPeaks = request.query.showSummittedPeaks === "true";
        const bounds =
            northWestLat && northWestLng && southEastLat && southEastLng
                ? ([
                      [parseFloat(northWestLat), parseFloat(northWestLng)],
                      [parseFloat(southEastLat), parseFloat(southEastLng)],
                  ] as [[number, number], [number, number]])
                : undefined;

        if (bounds || search) {
            const peaks = await getUnclimbedPeaks(
                userId,
                bounds,
                search,
                showSummittedPeaks
            );
            reply.code(200).send(peaks);
        } else {
            reply
                .code(400)
                .send({ message: "Bounds or search query required" });
        }
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

    fastify.get<{
        Querystring: {
            userId: string;
            peakId: string;
        };
    }>("/peaks/favorite", async function (request, reply) {
        const userId = request.query.userId;
        const peakId = request.query.peakId;

        const isFavorited = await getIsPeakFavorited(userId, peakId);

        reply.code(200).send({ isFavorited });
    });

    done();
};

export default peaks;
