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
import updateActivityReport from "../helpers/activities/updateActivityReport";
import dismissActivityReview from "../helpers/activities/dismissActivityReview";
import getPublicActivity from "../helpers/activities/getPublicActivity";
import getUnreviewedActivities from "../helpers/activities/getUnreviewedActivities";
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

    // Get activities needing trip report review - owner only
    fastify.get<{
        Querystring: {
            limit?: string;
        };
    }>(
        "/unreviewed",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            const limit = request.query.limit
                ? parseInt(request.query.limit)
                : 10;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const activities = await getUnreviewedActivities(userId, limit);

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

    // Activity detail endpoint - owner only
    // Per Strava API guidelines: "Strava Data provided by a specific user can only be
    // displayed or disclosed in your Developer Application to that user."
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

            // Return 404 if activity doesn't exist or user is not the owner
            // (Use 404 instead of 403 to not reveal existence of other users' activities)
            if (!ownerId || !ensureOwner(request, reply, ownerId)) {
                if (ownerId === null) {
                    reply.code(404).send({ message: "Activity not found" });
                }
                return;
            }

            const { activity, summits } = await getActivityDetails(
                activityId
            );

            reply.code(200).send({ activity, summits });
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

    // Update activity trip report - owner only
    fastify.put<{
        Params: {
            activityId: string;
        };
        Body: {
            tripReport?: string;
            tripReportIsPublic?: boolean;
            displayTitle?: string;
            conditionTags?: string[];
        };
    }>(
        "/:activityId/report",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const { activityId } = request.params;
            const { tripReport, tripReportIsPublic, displayTitle, conditionTags } = request.body;

            const ownerId = await getActivityOwnerId(activityId);

            if (!ownerId || !ensureOwner(request, reply, ownerId)) {
                if (ownerId === null) {
                    reply.code(404).send({ message: "Activity not found" });
                }
                return;
            }

            const activity = await updateActivityReport(activityId, {
                tripReport,
                tripReportIsPublic,
                displayTitle,
                conditionTags,
            });

            if (!activity) {
                reply.code(404).send({ message: "Activity not found" });
                return;
            }

            reply.code(200).send(activity);
        }
    );

    // Dismiss activity review - owner only
    fastify.post<{
        Params: {
            activityId: string;
        };
    }>(
        "/:activityId/dismiss",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const { activityId } = request.params;

            const ownerId = await getActivityOwnerId(activityId);

            if (!ownerId || !ensureOwner(request, reply, ownerId)) {
                if (ownerId === null) {
                    reply.code(404).send({ message: "Activity not found" });
                }
                return;
            }

            const result = await dismissActivityReview(activityId);

            reply.code(200).send(result);
        }
    );

    // Get public activity data - unauthenticated
    // Returns only PathQuest-owned data (no Strava data)
    fastify.get<{
        Params: {
            activityId: string;
        };
    }>(
        "/:activityId/public",
        async function (request, reply) {
            const { activityId } = request.params;

            const publicActivity = await getPublicActivity(activityId);

            if (!publicActivity) {
                reply.code(404).send({ message: "Activity not found or has no public data" });
                return;
            }

            reply.code(200).send(publicActivity);
        }
    );

    done();
};

export default activities;
