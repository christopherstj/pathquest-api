import { config } from "dotenv";
config();
import Fastify from "fastify";
import getStravaAccessToken from "./helpers/getStravaAccessToken";
import historicalData from "./routes/historical-data";
import peaks from "./routes/peaks";
import challenges from "./routes/challenges";
import activites from "./routes/activites";
import auth from "./routes/auth";
import billing from "./routes/billing";
import user from "./routes/user";

const fastify = Fastify({
    logger: true,
});

// UNUSED ROUTE - Consider removing
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
fastify.register(user);
fastify.register(billing);
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
