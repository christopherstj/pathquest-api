import { FastifyInstance } from "fastify";
import getActivityByPeak from "../helpers/activities/getActivitiesByPeak";
import searchActivities from "../helpers/activities/searchActivities";
import getCoordsByActivity from "../helpers/activities/getCoordsByActivity";
import getActivityDetails from "../helpers/activities/getActivityDetails";
import getMostRecentActivities from "../helpers/activities/getMostRecentActivities";
import searchNearestActivities from "../helpers/activities/searchNearestActivities";
import deleteActivity from "../helpers/activities/deleteActivity";
import getActivityOwnerId from "../helpers/activities/getActivityOwnerId";
import reprocessActivity from "../helpers/activities/reprocessActivity";
import { ensureOwner } from "../helpers/authz";

const activities = (fastify: FastifyInstance, _: any, done: any) => {
    fastify.get<{
        Querystring: {
            summitsOnly?: string;
        };
    }>(
        "/recent",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            const summitsOnly = request.query.summitsOnly === "true";

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const activities = await getMostRecentActivities(
                userId,
                summitsOnly
            );

            reply.code(200).send(activities);
        }
    );

    fastify.get<{
        Querystring: {
            lat: string;
            lng: string;
            page?: string;
            search?: string;
        };
    }>(
        "/search/nearest",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const userId = request.user?.id;
            const lat = parseFloat(request.query.lat);
            const lng = parseFloat(request.query.lng);
            const search = request.query.search;
            const page = request.query.page ? parseInt(request.query.page) : 1;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const activities = await searchNearestActivities(
                lat,
                lng,
                userId,
                page,
                search
            );

            reply.code(200).send(activities);
        }
    );

    fastify.post<{
        Body: {
            peakId: string;
        };
    }>(
        "/by-peak",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            const peakId = request.body.peakId;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const activities = await getActivityByPeak(peakId, userId);

            reply.code(200).send(activities);
        }
    );

    fastify.get<{
        Params: {
            activityId: string;
        };
    }>(
        "/:activityId",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const { activityId } = request.params;

            const ownerId = await getActivityOwnerId(activityId);

            if (!ensureOwner(request, reply, ownerId)) {
                return;
            }

            const { activity, peakSummits } = await getActivityDetails(
                activityId
            );

            reply.code(200).send({ activity, peakSummits });
        }
    );

    fastify.delete<{
        Params: {
            activityId: string;
        };
    }>(
        "/:activityId",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const { activityId } = request.params;

            const ownerId = await getActivityOwnerId(activityId);

            if (!ensureOwner(request, reply, ownerId)) {
                return;
            }

            await deleteActivity(activityId);

            reply.code(200).send({ message: "Activity deleted" });
        }
    );

    fastify.get<{
        Params: {
            activityId: string;
        };
    }>(
        "/:activityId/coords",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const { activityId } = request.params;

            const ownerId = await getActivityOwnerId(activityId);

            if (!ensureOwner(request, reply, ownerId)) {
                return;
            }

            const coords = await getCoordsByActivity(activityId);

            reply.code(200).send({ coords });
        }
    );

    fastify.get<{
        Querystring: {
            northWestLat?: string;
            northWestLng?: string;
            southEastLat?: string;
            southEastLng?: string;
            search?: string;
        };
    }>(
        "/search",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const {
                northWestLat,
                northWestLng,
                southEastLat,
                southEastLng,
                search,
            } = request.query;

            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

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
        }
    );

    fastify.post<{
        Body: {
            activityId: string;
        };
    }>(
        "/reprocess",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const userId = request.user?.id;
            const activityId = request.body.activityId;

            const ownerId = await getActivityOwnerId(activityId);

            if (!ensureOwner(request, reply, ownerId)) {
                return;
            }

            const result = await reprocessActivity(
                parseInt(activityId),
                userId!
            );

            if (result.success) {
                reply.code(200).send({ message: "Success" });
            } else {
                reply
                    .code(500)
                    .send({ message: "Failed to reprocess activity" });
            }
        }
    );

    done();
};

export default activities;
