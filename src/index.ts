import { config } from "dotenv";
config();
import Fastify from "fastify";
import historicalData from "./routes/historical-data";
import peaks from "./routes/peaks";
import challenges from "./routes/challenges";
import activities from "./routes/activities";
import auth from "./routes/auth";
import mobileAuth from "./routes/auth/mobile";
import billing from "./routes/billing";
import user from "./routes/user";
import dashboard from "./routes/dashboard";
import photos from "./routes/photos";
import pushTokens from "./routes/push-tokens";
import utils from "./routes/utils";
import search from "./routes/search";
import trails from "./routes/trails";
import map from "./routes/map";
import conditions from "./routes/conditions";
import snow from "./routes/snow";
import fires from "./routes/fires";
import authPlugin from "./plugins/auth";

const fastify = Fastify({
    logger: true,
});

fastify.register(authPlugin);

fastify.register(auth, { prefix: "/api/auth" });
fastify.register(mobileAuth, { prefix: "/api/auth/mobile" });
fastify.register(user, { prefix: "/api/users" });
fastify.register(billing, { prefix: "/api/billing" });
fastify.register(historicalData, { prefix: "/api/historical-data" });
fastify.register(peaks, { prefix: "/api/peaks" });
fastify.register(challenges, { prefix: "/api/challenges" });
fastify.register(activities, { prefix: "/api/activities" });
fastify.register(dashboard, { prefix: "/api/dashboard" });
fastify.register(photos, { prefix: "/api/photos" });
fastify.register(pushTokens, { prefix: "/api/push-tokens" });
fastify.register(utils, { prefix: "/api/utils" });
fastify.register(search, { prefix: "/api/search" });
fastify.register(trails, { prefix: "/api/trails" });
fastify.register(map, { prefix: "/api/map" });
fastify.register(conditions, { prefix: "/api/conditions" });
fastify.register(snow, { prefix: "/api/snow" });
fastify.register(fires, { prefix: "/api/fires" });

fastify.listen({ port: 8080, host: "0.0.0.0" }, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
});
