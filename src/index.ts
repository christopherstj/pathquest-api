import { config } from "dotenv";
config();
import Fastify from "fastify";
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
import getIsPeakFavorited from "./helpers/peaks/getIsPeakFavorited";
import getActivityByPeak from "./helpers/activities/getActivitiesByPeak";
import getUnclimbedPeaks from "./helpers/peaks/getUnclimbedPeaks";
import getPeakById from "./helpers/peaks/getPeakById";
import getSummitsByPeak from "./helpers/peaks/getSummitsByPeak";
import getStravaAccessToken from "./helpers/getStravaAccessToken";
import getAllChallenges from "./helpers/challenges/getAllChallenges";
import getPeaksByChallenge from "./helpers/challenges/getPeaksByChallenge";
import getMostRecentSummitByPeak from "./helpers/peaks/getMostRecentSummitByPeak";
import getChallengeById from "./helpers/challenges/getChallengeById";
import historicalData from "./routes/historical-data";
import peaks from "./routes/peaks";
import challenges from "./routes/challenges";
import activites from "./routes/activites";
import auth from "./routes/auth";

const fastify = Fastify({
    logger: true,
});

fastify.get<{
    Querystring: {
        userId: string;
        activityId: string;
    };
}>("/", async function (request, reply) {
    const { userId, activityId } = request.query;

    const token = await getStravaAccessToken(userId);

    const activity = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    reply.send(await activity.json());
});

fastify.register(auth);
fastify.register(historicalData);
fastify.register(peaks);
fastify.register(challenges);
fastify.register(activites);

fastify.listen({ port: 8080, host: "0.0.0.0" }, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
});
