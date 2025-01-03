import { FastifyInstance } from "fastify";
import getActivityByPeak from "../helpers/activities/getActivitiesByPeak";
import searchActivities from "../helpers/activities/searchActivities";
import getCoordsByActivity from "../helpers/activities/getCoordsByActivity";
import getActivityDetails from "../helpers/activities/getActivityDetails";
import getMostRecentActivities from "../helpers/activities/getMostRecentActivities";
import searchNearestActivities from "../helpers/activities/searchNearestActivities";

const activites = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.get<{
        Querystring: {
            userId: string;
        };
    }>("/activities/recent", async function (request, reply) {
        const userId = request.query.userId;

        const activities = await getMostRecentActivities(userId);

        reply.code(200).send(activities);
    });

    fastify.get<{
        Querystring: {
            userId: string;
            lat: string;
            lng: string;
            page?: string;
            search?: string;
        };
    }>("/activities/search/nearest", async (request, reply) => {
        const userId = request.query.userId;
        const lat = parseFloat(request.query.lat);
        const lng = parseFloat(request.query.lng);
        const search = request.query.search;
        const page = request.query.page ? parseInt(request.query.page) : 1;

        const activities = await searchNearestActivities(
            lat,
            lng,
            userId,
            page,
            search
        );

        reply.code(200).send(activities);
    });

    fastify.post<{
        Body: {
            userId: string;
            peakId: string;
        };
    }>("/activities/peak", async function (request, reply) {
        const userId = request.body.userId;
        const peakId = request.body.peakId;

        const activities = await getActivityByPeak(peakId, userId);

        reply.code(200).send(activities);
    });

    fastify.get<{
        Params: {
            activityId: string;
        };
    }>("/activities/:activityId", async function (request, reply) {
        const activityId = request.params.activityId;

        const { activity, peakSummits } = await getActivityDetails(activityId);

        console.log(peakSummits);

        reply.code(200).send({ activity, peakSummits });
    });

    fastify.get<{
        Params: {
            activityId: string;
        };
    }>("/activities/:activityId/coords", async function (request, reply) {
        const activityId = request.params.activityId;

        const coords = await getCoordsByActivity(activityId);

        reply.code(200).send({ coords });
    });

    fastify.get<{
        Querystring: {
            userId: string;
            northWestLat?: string;
            northWestLng?: string;
            southEastLat?: string;
            southEastLng?: string;
            search?: string;
        };
    }>("/activities/search", async function (request, reply) {
        const {
            userId,
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

        const activities = await searchActivities(userId, search, bounds);

        reply.code(200).send(activities);
    });

    done();
};

export default activites;
