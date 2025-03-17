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
import ManualPeakSummit from "../typeDefs/ManualPeakSummit";
import addManualPeakSummit from "../helpers/peaks/addManualPeakSummit";
import getRecentSummits from "../helpers/peaks/getRecentSummits";
import searchNearestPeaks from "../helpers/peaks/searchNearestPeaks";
import getAscentDetails from "../helpers/peaks/getAscentDetails";
import PeakSummit from "../typeDefs/PeakSummit";
import AscentDetail from "../typeDefs/AscentDetail";
import updateAscent from "../helpers/peaks/updateAscent";
import getAscentOwnerId from "../helpers/peaks/getAscentOwnerId";
import deleteAscent from "../helpers/peaks/deleteAscent";
import getWeather from "../helpers/peaks/getWeather";

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
            peakId: string;
        };
    }>("/peaks/:peakId/weather", async function (request, reply) {
        const peakId = request.params.peakId;
        const data = await getWeather(peakId);
        reply.code(200).send(data);
    });

    fastify.get<{
        Querystring: {
            userId: string;
            lat: string;
            lng: string;
            page?: string;
            search?: string;
        };
    }>("/peaks/search/nearest", async (request, reply) => {
        const userId = request.query.userId;
        const lat = parseFloat(request.query.lat);
        const lng = parseFloat(request.query.lng);
        const search = request.query.search;
        const page = request.query.page ? parseInt(request.query.page) : 1;

        const peaks = await searchNearestPeaks(lat, lng, userId, page, search);

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
            const activities = await getActivityByPeak(peakId, userId, true);
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
        Body: ManualPeakSummit;
    }>("/peaks/summits/manual", async (request, reply) => {
        const data = request.body;
        await addManualPeakSummit(data);
        reply.code(200).send({ message: "Summit added" });
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

    fastify.get<{
        Querystring: {
            userId: string;
        };
    }>("/peaks/summits/recent", async function (request, reply) {
        const userId = request.query.userId;
        const peaks = await getRecentSummits(userId);
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

    fastify.get<{
        Querystring: {
            userId: string;
        };
        Params: {
            ascentId: string;
        };
    }>("/peaks/ascent/:ascentId", async function (request, reply) {
        const userId = request.query.userId;
        const ascentId = request.params.ascentId;

        const ascent = await getAscentDetails(ascentId, userId);

        if (!ascent) {
            reply.code(404).send({ message: "Ascent not found" });
            return;
        }

        const peak = await getPeakById(ascent.peakId, userId);

        if (!peak) {
            reply.code(404).send({ message: "Peak not found" });
            return;
        }

        const otherAscents = await getSummitsByPeak(ascent.peakId, userId);

        const peakSummit: PeakSummit = {
            ...peak,
            ascents: otherAscents,
        };

        reply.code(200).send({ ascent, peak: peakSummit });
    });

    fastify.put<{
        Querystring: {
            userId: string;
        };
        Body: {
            ascent: AscentDetail;
        };
    }>("/peaks/ascent/:ascentId", async function (request, reply) {
        const userId = request.query.userId;
        const ascent = request.body.ascent;

        const ownerId = await getAscentOwnerId(ascent.id);

        if (!ownerId || ownerId.toString() !== userId.toString()) {
            reply.code(403).send({ message: "Unauthorized" });
            return;
        }

        await updateAscent(ascent);

        reply.code(200).send();
    });

    fastify.delete<{
        Querystring: {
            userId: string;
        };
        Params: {
            ascentId: string;
        };
    }>("/peaks/ascent/:ascentId", async function (request, reply) {
        const userId = request.query.userId;
        const ascentId = request.params.ascentId;

        const ownerId = await getAscentOwnerId(ascentId);

        if (!ownerId || ownerId.toString() !== userId.toString()) {
            reply.code(403).send({ message: "Unauthorized" });
            return;
        }

        await deleteAscent(ascentId);

        reply.code(200).send();
    });

    done();
};

export default peaks;
