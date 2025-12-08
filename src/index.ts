import { config } from "dotenv";
config();
import Fastify from "fastify";
import historicalData from "./routes/historical-data";
import peaks from "./routes/peaks";
import challenges from "./routes/challenges";
import activities from "./routes/activities";
import auth from "./routes/auth";
import billing from "./routes/billing";
import user from "./routes/user";
import authPlugin from "./plugins/auth";

const fastify = Fastify({
    logger: true,
});

fastify.register(authPlugin);

fastify.register(auth, { prefix: "/api/auth" });
fastify.register(user, { prefix: "/api/users" });
fastify.register(billing, { prefix: "/api/billing" });
fastify.register(historicalData, { prefix: "/api/historical-data" });
fastify.register(peaks, { prefix: "/api/peaks" });
fastify.register(challenges, { prefix: "/api/challenges" });
fastify.register(activities, { prefix: "/api/activities" });

fastify.listen({ port: 8080, host: "0.0.0.0" }, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
});
