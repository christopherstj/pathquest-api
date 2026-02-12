import { FastifyInstance } from "fastify";
import getPeaks from "../helpers/peaks/getPeaks";
import getPeakById from "../helpers/peaks/getPeakById";
import getActivityByPeak from "../helpers/activities/getActivitiesByPeak";
import getSummitsByPeak from "../helpers/peaks/getSummitsByPeak";
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
import AscentDetail from "../typeDefs/AscentDetail";
import updateAscent from "../helpers/peaks/updateAscent";
import getAscentOwnerId from "../helpers/peaks/getAscentOwnerId";
import deleteAscent from "../helpers/peaks/deleteAscent";
import getPeakSummitsByUser from "../helpers/peaks/getPeakSummitsByUser";
import searchPeaks from "../helpers/peaks/searchPeaks";
import Peak from "../typeDefs/Peak";
import getChallengesByPeak from "../helpers/challenges/getChallengesByPeak";
import getPublicSummitsByPeak from "../helpers/peaks/getPublicSummitsByPeak";
import getPublicSummitsByPeakCursor from "../helpers/peaks/getPublicSummitsByPeakCursor";
import { ensureOwner } from "../helpers/authz";
import getTopPeaksBySummitCount from "../helpers/peaks/getTopPeaksBySummitCount";
import getRecentPublicSummits from "../helpers/peaks/getRecentPublicSummits";
import getUnconfirmedSummits from "../helpers/peaks/getUnconfirmedSummits";
import confirmSummit from "../helpers/peaks/confirmSummit";
import denySummit from "../helpers/peaks/denySummit";
import confirmAllSummits from "../helpers/peaks/confirmAllSummits";
import getPeakActivity from "../helpers/peaks/getPeakActivity";
import getCurrentWeather from "../helpers/peaks/getCurrentWeather";
import getPeakForecast from "../helpers/peaks/getPeakForecast";
import flagPeakForReview from "../helpers/peaks/flagPeakForReview";
import getPhotosByPeak from "../helpers/photos/getPhotosByPeak";
import getPeakConditionsHelper from "../helpers/conditions/getPeakConditions";
import getSummitWindow from "../helpers/conditions/getSummitWindow";
import triggerOnDemandWeatherFetch from "../helpers/conditions/triggerOnDemandWeatherFetch";
import recordPeakView from "../helpers/conditions/recordPeakView";
import resolveSourceConditions from "../helpers/conditions/resolveSourceConditions";
import { generateGearWithLLM } from "../helpers/conditions/generateGearWithLLM";
import getCloudSqlConnection from "../helpers/getCloudSqlConnection";
import getPeakConditionsHistory from "../helpers/conditions/getPeakConditionsHistory";
// sendSummitNotification is used by activity sync, not manual summit routes
// import sendSummitNotification from "../helpers/notifications/sendSummitNotification";

const peaks = (fastify: FastifyInstance, _: any, done: any) => {
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

        const peaks = await getPeaks(page, perPage, search);
        reply.code(200).send(peaks);
    });

    // Get top peaks by public summit count (for static generation)
    fastify.get<{
        Querystring: {
            limit?: string;
        };
    }>("/top", async function (request, reply) {
        const limit = parseInt(request.query.limit ?? "1000");
        const peaks = await getTopPeaksBySummitCount(limit);
        reply.code(200).send(peaks);
    });

    fastify.get<{
        Querystring: {
            northWestLat?: string;
            northWestLng?: string;
            southEastLat?: string;
            southEastLng?: string;
            page?: string;
            perPage?: string;
            search?: string;
            state?: string;
            showSummittedPeaks?: string;
        };
    }>(
        "/search",
        { onRequest: [fastify.optionalAuth] },
        async function (request, reply) {
            const northWestLat = request.query.northWestLat
                ? parseFloat(request.query.northWestLat)
                : undefined;
            const northWestLng = request.query.northWestLng
                ? parseFloat(request.query.northWestLng)
                : undefined;
            const southEastLat = request.query.southEastLat
                ? parseFloat(request.query.southEastLat)
                : undefined;
            const southEastLng = request.query.southEastLng
                ? parseFloat(request.query.southEastLng)
                : undefined;
            const page = request.query.page
                ? parseInt(request.query.page)
                : undefined;
            const perPage = request.query.perPage
                ? parseInt(request.query.perPage)
                : undefined;
            const search = request.query.search;
            const state = request.query.state;
            const userId = request.user?.id;
            const showSummittedPeaks = request.query.showSummittedPeaks === "true";

            const bounds =
                northWestLat && northWestLng && southEastLat && southEastLng
                    ? ([
                          [northWestLat, northWestLng],
                          [southEastLat, southEastLng],
                      ] as [[number, number], [number, number]])
                    : undefined;

            const addPagination = !search && !state && !bounds && (!page || !perPage);

            const peaks = await searchPeaks(
                bounds,
                userId,
                search,
                showSummittedPeaks,
                addPagination ? 1 : page,
                addPagination ? 1000 : perPage,
                state
            );

            reply.code(200).send(peaks);
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
        { onRequest: [fastify.optionalAuth] },
        async (request, reply) => {
            const userId = request.user?.id;
            const lat = parseFloat(request.query.lat);
            const lng = parseFloat(request.query.lng);
            const search = request.query.search;
            const page = request.query.page ? parseInt(request.query.page) : 1;

            const peaks = await searchNearestPeaks(
                lat,
                lng,
                userId ?? "",
                page,
                search
            );

            reply.code(200).send(peaks);
        }
    );

    fastify.get<{
        Params: {
            id: string;
        };
    }>(
        "/:id",
        { onRequest: [fastify.optionalAuth] },
        async function (request, reply) {
            const peakId = request.params.id;
            const userId = request.user?.id;

            const peak = await getPeakById(peakId, userId ?? "");

            if (!peak) {
                reply.code(404).send({ message: "Peak not found" });
                return;
            }

            // Fire-and-forget: track peak view for smart fetching priority
            recordPeakView(peakId);

            const publicSummits = await getPublicSummitsByPeak(peakId);
            const challenges = await getChallengesByPeak(peakId, userId ?? "");

            if (userId) {
                const activities = await getActivityByPeak(peakId, userId, true);
                const summits = await getSummitsByPeak(peakId, userId);
                reply.code(200).send({
                    peak: {
                        ...peak,
                        ascents: summits,
                    } as Peak,
                    publicSummits,
                    activities,
                    challenges,
                });
            } else {
                reply.code(200).send({ peak, publicSummits, challenges });
            }
        }
    );

    // Get public summits with cursor pagination
    fastify.get<{
        Params: {
            id: string;
        };
        Querystring: {
            cursor?: string;
            limit?: string;
        };
    }>("/:id/public-summits", async function (request, reply) {
        const peakId = request.params.id;
        const cursor = request.query.cursor;
        const limit = request.query.limit ? parseInt(request.query.limit) : 20;
        const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 100
            ? limit
            : 20;

        try {
            const result = await getPublicSummitsByPeakCursor(peakId, {
                cursor,
                limit: safeLimit,
            });

            reply.code(200).send(result);
        } catch (error) {
            console.error("Error fetching public summits:", error);
            reply.code(500).send({ message: "Error fetching public summits" });
        }
    });

    // Public photos for a peak with cursor-based pagination
    // (native uploads only; Strava photos are not allowed)
    fastify.get<{
        Params: { id: string };
        Querystring: { cursor?: string; limit?: string };
    }>("/:id/photos", async function (request, reply) {
        const peakId = request.params.id;
        const cursor = request.query.cursor;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;

        const result = await getPhotosByPeak({ 
            peakId, 
            filters: { cursor, limit } 
        });
        reply.code(200).send(result);
    });

    // Get peak activity (recent summit counts)
    fastify.get<{
        Params: {
            id: string;
        };
    }>("/:id/activity", async function (request, reply) {
        const peakId = request.params.id;
        const activity = await getPeakActivity(peakId);
        reply.code(200).send(activity);
    });

    // Get current weather for a peak
    fastify.get<{
        Params: {
            id: string;
        };
    }>("/:id/weather", async function (request, reply) {
        const peakId = request.params.id;
        
        // First get the peak to get its coordinates and elevation
        const peak = await getPeakById(peakId, "");
        
        if (!peak) {
            reply.code(404).send({ message: "Peak not found" });
            return;
        }
        
        if (!peak.location_coords) {
            reply.code(400).send({ message: "Peak has no coordinates" });
            return;
        }
        
        const weather = await getCurrentWeather(
            { lat: peak.location_coords[1], lon: peak.location_coords[0] },
            peak.elevation ?? undefined
        );
        
        reply.code(200).send(weather);
    });

    // Get 7-day forecast for a peak
    fastify.get<{
        Params: {
            id: string;
        };
    }>("/:id/forecast", async function (request, reply) {
        const peakId = request.params.id;
        
        // First get the peak to get its coordinates and elevation
        const peak = await getPeakById(peakId, "");
        
        if (!peak) {
            reply.code(404).send({ message: "Peak not found" });
            return;
        }
        
        if (!peak.location_coords) {
            reply.code(400).send({ message: "Peak has no coordinates" });
            return;
        }
        
        const forecast = await getPeakForecast(
            { lat: peak.location_coords[1], lon: peak.location_coords[0] },
            peak.elevation ?? undefined
        );
        
        reply.code(200).send(forecast);
    });

    // Get full conditions for a peak (weather, recent weather, summit window)
    fastify.get<{
        Params: {
            id: string;
        };
    }>("/:id/conditions", async function (request, reply) {
        const peakId = request.params.id;
        const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

        // Try reading cached conditions
        let conditions = await getPeakConditionsHelper(peakId);

        // If missing or weather is stale, trigger on-demand fetch
        const isStale = !conditions?.weather_updated_at ||
            Date.now() - new Date(conditions.weather_updated_at).getTime() > STALE_THRESHOLD_MS;

        if (isStale) {
            // Try triggering on-demand ingestion
            await triggerOnDemandWeatherFetch(peakId);

            // Re-read after trigger (the ingester responds synchronously)
            conditions = await getPeakConditionsHelper(peakId);
        }

        // Resolve source-level conditions (avalanche, snotel, alerts, streamflow, aqi, fires)
        const sourceConditions = await resolveSourceConditions(peakId);

        // If still no conditions, fall back to live Open-Meteo fetch
        if (!conditions?.weather_forecast) {
            const peak = await getPeakById(peakId, "");
            if (!peak || !peak.location_coords) {
                reply.code(404).send({ message: "Peak not found" });
                return;
            }

            const [weather, forecast] = await Promise.all([
                getCurrentWeather(
                    { lat: peak.location_coords[1], lon: peak.location_coords[0] },
                    peak.elevation ?? undefined
                ),
                getPeakForecast(
                    { lat: peak.location_coords[1], lon: peak.location_coords[0] },
                    peak.elevation ?? undefined
                ),
            ]);

            // Return a compatible fallback shape — pad daily items to match
            // the resolveWeatherForecast output so clients get a consistent schema
            const daily = forecast.daily.map(d => ({
                ...d,
                precipSum: null,
                snowfallSum: null,
                windGusts: null,
                daylightSeconds: null,
                uvIndexMax: null,
            }));

            const fallbackWeather = {
                current: weather,
                daily,
                timezone: null,
            };

            const gear = await generateGearWithLLM({
                weatherForecast: fallbackWeather,
                recentWeather: null,
                snotelData: sourceConditions.snotel,
                avalancheForecast: sourceConditions.avalanche,
                streamFlow: sourceConditions.streamFlow,
                airQuality: sourceConditions.airQuality,
                fireProximity: sourceConditions.fireProximity,
                trailConditions: null,
            });

            // Fire-and-forget: cache LLM gear result back to DB
            getCloudSqlConnection().then((pool) =>
                pool.query(
                    `UPDATE peak_conditions
                     SET gear_recommendations = $2, gear_updated_at = NOW(), updated_at = NOW()
                     WHERE peak_id = $1`,
                    [peakId, JSON.stringify(gear)]
                ).catch(() => {})
            ).catch(() => {});

            reply.code(200).send({
                peakId,
                weather: fallbackWeather,
                recentWeather: null,
                summitWindow: null,
                weatherUpdatedAt: new Date().toISOString(),
                avalanche: sourceConditions.avalanche,
                avalancheUpdatedAt: null,
                snotel: sourceConditions.snotel,
                snotelUpdatedAt: null,
                nwsAlerts: sourceConditions.nwsAlerts,
                nwsAlertsUpdatedAt: null,
                streamFlow: sourceConditions.streamFlow,
                streamFlowUpdatedAt: null,
                trailConditions: null,
                trailConditionsUpdatedAt: null,
                airQuality: sourceConditions.airQuality,
                airQualityUpdatedAt: null,
                fireProximity: sourceConditions.fireProximity,
                fireProximityUpdatedAt: null,
                roadAccess: null,
                roadAccessUpdatedAt: null,
                gearRecommendations: gear,
                gearUpdatedAt: gear.updatedAt,
            });
            return;
        }

        // Compute gear recommendations via LLM (falls back to rules-based)
        const gear = await generateGearWithLLM({
            weatherForecast: conditions.weather_forecast,
            recentWeather: conditions.recent_weather,
            snotelData: sourceConditions.snotel,
            avalancheForecast: sourceConditions.avalanche,
            streamFlow: sourceConditions.streamFlow,
            airQuality: sourceConditions.airQuality,
            fireProximity: sourceConditions.fireProximity,
            trailConditions: conditions.trail_conditions,
        });

        // Fire-and-forget: cache LLM gear result back to DB
        getCloudSqlConnection().then((pool) =>
            pool.query(
                `UPDATE peak_conditions
                 SET gear_recommendations = $2, gear_updated_at = NOW(), updated_at = NOW()
                 WHERE peak_id = $1`,
                [conditions.peak_id, JSON.stringify(gear)]
            ).catch(() => {})
        ).catch(() => {});

        reply.code(200).send({
            peakId: conditions.peak_id,
            weather: conditions.weather_forecast,
            recentWeather: conditions.recent_weather,
            summitWindow: conditions.summit_window,
            weatherUpdatedAt: conditions.weather_updated_at?.toISOString() ?? null,
            avalanche: sourceConditions.avalanche,
            avalancheUpdatedAt: null,
            snotel: sourceConditions.snotel,
            snotelUpdatedAt: null,
            nwsAlerts: sourceConditions.nwsAlerts,
            nwsAlertsUpdatedAt: null,
            streamFlow: sourceConditions.streamFlow,
            streamFlowUpdatedAt: null,
            trailConditions: conditions.trail_conditions,
            trailConditionsUpdatedAt: conditions.trail_conditions_updated_at?.toISOString() ?? null,
            airQuality: sourceConditions.airQuality,
            airQualityUpdatedAt: null,
            fireProximity: sourceConditions.fireProximity,
            fireProximityUpdatedAt: null,
            roadAccess: conditions.road_access,
            roadAccessUpdatedAt: conditions.road_access_updated_at?.toISOString() ?? null,
            gearRecommendations: gear,
            gearUpdatedAt: gear.updatedAt,
        });
    });

    // Get 7-day summit window scoring for a peak
    fastify.get<{
        Params: {
            id: string;
        };
    }>("/:id/summit-window", async function (request, reply) {
        const peakId = request.params.id;
        const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

        // Check cached conditions for staleness
        const conditions = await getPeakConditionsHelper(peakId);
        const isStale = !conditions?.weather_updated_at ||
            Date.now() - new Date(conditions.weather_updated_at).getTime() > STALE_THRESHOLD_MS;

        if (!conditions?.summit_window || isStale) {
            // Trigger on-demand fetch and retry
            await triggerOnDemandWeatherFetch(peakId);
            const retried = await getSummitWindow(peakId);

            if (!retried) {
                reply.code(404).send({ message: "Summit window not available for this peak" });
                return;
            }

            reply.code(200).send(retried);
            return;
        }

        reply.code(200).send(conditions.summit_window);
    });

    // GET /api/peaks/:id/conditions/history?range=30d|90d|1y&sources=snotel,streamflow,aqi
    fastify.get<{
        Params: { id: string };
        Querystring: { range?: string; sources?: string };
    }>("/:id/conditions/history", async function (request, reply) {
        const peakId = request.params.id;
        const range = request.query.range ?? "30d";
        const validRanges = ["30d", "90d", "1y"];
        if (!validRanges.includes(range)) {
            reply.code(400).send({ message: "Invalid range. Use 30d, 90d, or 1y" });
            return;
        }

        const sourcesParam = request.query.sources ?? "snotel,streamflow,aqi";
        const validSources = ["snotel", "streamflow", "aqi"];
        const sources = sourcesParam.split(",").filter((s) => validSources.includes(s));
        if (sources.length === 0) {
            reply.code(400).send({ message: "Invalid sources. Use snotel, streamflow, aqi" });
            return;
        }

        const history = await getPeakConditionsHistory(
            peakId,
            range as "30d" | "90d" | "1y",
            sources
        );
        reply.code(200).send(history);
    });

    // Flag a peak for coordinate review
    fastify.post<{
        Params: {
            id: string;
        };
    }>(
        "/:id/flag-for-review",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const peakId = request.params.id;
            
            const success = await flagPeakForReview(peakId);
            
            if (!success) {
                reply.code(404).send({ message: "Peak not found" });
                return;
            }
            
            reply.code(200).send({ message: "Peak flagged for review" });
        }
    );

    fastify.get<{
        Params: {
            userId: string;
        };
    }>(
        "/summits/:userId",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.params.userId;
            const includePrivate = request.user?.id === userId;

            if (!includePrivate) {
                reply.code(403).send({ message: "Forbidden" });
                return;
            }

            const peaks = await getPeakSummitsByUser(userId, includePrivate);
            reply.code(200).send(peaks);
        }
    );

    fastify.get("/summits/unclimbed/nearest", {
        onRequest: [fastify.authenticate],
        handler: async function (request, reply) {
            const userId = request.user?.id;
            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }
            const peaks = await getNearestUnclimbedPeaks(userId);
            reply.code(200).send(peaks);
        },
    });

    fastify.get<{
        Querystring: {
            northWestLat?: string;
            northWestLng?: string;
            southEastLat?: string;
            southEastLng?: string;
            search?: string;
            showSummittedPeaks?: string;
        };
    }>(
        "/summits/unclimbed",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const {
                northWestLat,
                northWestLng,
                southEastLat,
                southEastLng,
                search,
            } = request.query;
            const showSummittedPeaks =
                request.query.showSummittedPeaks === "true";
            const bounds =
                northWestLat && northWestLng && southEastLat && southEastLng
                    ? ([
                          [parseFloat(northWestLat), parseFloat(northWestLng)],
                          [parseFloat(southEastLat), parseFloat(southEastLng)],
                      ] as [[number, number], [number, number]])
                    : undefined;

            const userId = request.user?.id;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

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
        }
    );

    fastify.post<{
        Body: ManualPeakSummit;
    }>(
        "/summits/manual",
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            const data = request.body;
            if (!ensureOwner(request, reply, data.user_id)) {
                return;
            }
            await addManualPeakSummit(data);
            
            // Note: No push notification for manual summits - user already knows they summited
            // Notifications are sent for auto-detected summits from Strava activity sync
            
            reply.code(200).send({ message: "Summit added" });
        }
    );

    fastify.get(
        "/summits/favorites",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }
            const peaks = await getFavoritePeaks(userId);
            reply.code(200).send(peaks);
        }
    );

    fastify.get(
        "/summits/recent",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }
            const peaks = await getRecentSummits(userId);
            reply.code(200).send(peaks);
        }
    );

    // Get most recent public summits across entire community (no auth)
    fastify.get<{
        Querystring: {
            limit?: string;
        };
    }>("/summits/public/recent", async function (request, reply) {
        const limit = parseInt(request.query.limit ?? "5");
        const safeLimit = Number.isFinite(limit)
            ? Math.max(1, Math.min(limit, 25))
            : 5;

        const summits = await getRecentPublicSummits(safeLimit);
        reply.code(200).send(summits);
    });

    // Get unconfirmed summits that need user review
    fastify.get<{
        Querystring: {
            limit?: string;
        };
    }>(
        "/summits/unconfirmed",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }
            const limit = request.query.limit
                ? parseInt(request.query.limit)
                : undefined;
            const summits = await getUnconfirmedSummits(userId, limit);
            reply.code(200).send(summits);
        }
    );

    // Confirm a summit
    fastify.post<{
        Params: {
            id: string;
        };
    }>(
        "/summits/:id/confirm",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }
            const summitId = request.params.id;
            const result = await confirmSummit(summitId, userId);
            if (!result.success) {
                reply.code(404).send({ message: result.message });
                return;
            }
            reply.code(200).send({ message: result.message });
        }
    );

    // Deny a summit
    fastify.post<{
        Params: {
            id: string;
        };
    }>(
        "/summits/:id/deny",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }
            const summitId = request.params.id;
            const result = await denySummit(summitId, userId);
            if (!result.success) {
                reply.code(404).send({ message: result.message });
                return;
            }
            reply.code(200).send({ message: result.message });
        }
    );

    // Confirm all unconfirmed summits
    fastify.post(
        "/summits/confirm-all",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }
            const result = await confirmAllSummits(userId);
            reply.code(200).send({ message: result.message, count: result.count });
        }
    );

    fastify.put<{
        Body: {
            newValue: boolean;
            peakId: string;
        };
    }>(
        "/favorite",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const newValue = request.body.newValue;
            const userId = request.user?.id;
            const peakId = request.body.peakId;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            if (newValue === true) {
                await addFavoritePeak(peakId, userId);
            } else {
                await removeFavoritePeak(userId, peakId);
            }

            reply.code(200).send({ message: "Peak favorite updated" });
        }
    );

    fastify.get<{
        Querystring: {
            peakId: string;
        };
    }>(
        "/favorite",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            const peakId = request.query.peakId;

            if (!userId) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const isFavorited = await getIsPeakFavorited(userId, peakId);

            reply.code(200).send({ isFavorited });
        }
    );

    fastify.get<{
        Params: {
            ascentId: string;
        };
    }>(
        "/ascent/:ascentId",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id ?? "";
            const ascentId = request.params.ascentId;

            const ownerId = await getAscentOwnerId(ascentId);
            if (!ensureOwner(request, reply, ownerId)) {
                return;
            }

            const ascent = await getAscentDetails(ascentId, userId);

            if (!ascent) {
                reply.code(404).send({ message: "Ascent not found" });
                return;
            }

            const peak = await getPeakById(ascent.peak_id, userId);

            if (!peak) {
                reply.code(404).send({ message: "Peak not found" });
                return;
            }

            const otherAscents = await getSummitsByPeak(ascent.peak_id, userId);

            const peakSummit: Peak = {
                ...peak,
                ascents: otherAscents,
            };

            reply.code(200).send({ ascent, peak: peakSummit });
        }
    );

    fastify.put<{
        Body: {
            ascent: AscentDetail;
        };
    }>(
        "/ascent/:ascentId",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            const ascent = request.body.ascent;

            const ownerId = await getAscentOwnerId(ascent.id);

            if (!ensureOwner(request, reply, ownerId)) {
                return;
            }

            await updateAscent(ascent);

            // Note: No push notification for ascent updates - user already knows about their summit
            // Notifications are sent for auto-detected summits from Strava activity sync

            reply.code(200).send();
        }
    );

    fastify.delete<{
        Params: {
            ascentId: string;
        };
    }>(
        "/ascent/:ascentId",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user?.id;
            const ascentId = request.params.ascentId;

            const ownerId = await getAscentOwnerId(ascentId);

            if (!ensureOwner(request, reply, ownerId)) {
                return;
            }

            await deleteAscent(ascentId);

            reply.code(200).send();
        }
    );

    done();
};

export default peaks;
