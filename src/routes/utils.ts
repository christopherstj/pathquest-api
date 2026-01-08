import { FastifyInstance } from "fastify";
import { find as findTimezone } from "geo-tz";

/**
 * Utility routes for miscellaneous API functions.
 */
const utils = (fastify: FastifyInstance, _: any, done: any) => {
    /**
     * GET /timezone
     * Get the IANA timezone for a given latitude/longitude.
     * 
     * Query params:
     *   - lat: Latitude (required)
     *   - lng: Longitude (required)
     * 
     * Returns:
     *   { timezone: string }
     */
    fastify.get<{
        Querystring: {
            lat: string;
            lng: string;
        };
    }>("/timezone", async function (request, reply) {
        const { lat, lng } = request.query;

        if (!lat || !lng) {
            reply.code(400).send({ message: "lat and lng are required" });
            return;
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        if (isNaN(latitude) || isNaN(longitude)) {
            reply.code(400).send({ message: "Invalid lat or lng" });
            return;
        }

        // Validate coordinate ranges
        if (latitude < -90 || latitude > 90) {
            reply.code(400).send({ message: "lat must be between -90 and 90" });
            return;
        }
        if (longitude < -180 || longitude > 180) {
            reply.code(400).send({ message: "lng must be between -180 and 180" });
            return;
        }

        try {
            const timezones = findTimezone(latitude, longitude);
            const timezone = timezones && timezones.length > 0 
                ? timezones[0] 
                : "America/New_York"; // Fallback

            reply.code(200).send({ timezone });
        } catch (error) {
            console.error("Error getting timezone from coordinates:", error);
            reply.code(500).send({ message: "Failed to determine timezone" });
        }
    });

    done();
};

export default utils;

