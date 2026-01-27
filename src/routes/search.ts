import { FastifyInstance } from "fastify";
import unifiedSearch from "../helpers/search/unifiedSearch";

const search = (fastify: FastifyInstance, _: unknown, done: () => void) => {
  /**
   * GET /search - Unified relevancy-based search
   * 
   * Combines peaks and challenges into a single ranked result set
   * based on text match, geographic proximity, and public popularity.
   * 
   * Query params:
   * - q (required): Search query string
   * - lat, lng (optional): Center coordinates for geographic relevancy
   * - bounds (optional): Viewport bounds as "minLng,minLat,maxLng,maxLat"
   * - limit (optional): Max results to return (default 20)
   * - includePeaks (optional): Include peaks in results (default true)
   * - includeChallenges (optional): Include challenges in results (default true)
   * 
   * Returns:
   * - results: Array of PeakSearchResult | ChallengeSearchResult, sorted by relevancyScore
   * - totalPeaks: Total matching peaks count
   * - totalChallenges: Total matching challenges count
   */
  fastify.get<{
    Querystring: {
      q: string;
      lat?: string;
      lng?: string;
      bounds?: string;
      limit?: string;
      includePeaks?: string;
      includeChallenges?: string;
    };
  }>(
    "/",
    { onRequest: [fastify.optionalAuth] },
    async function (request, reply) {
      const { q, lat, lng, bounds, limit, includePeaks, includeChallenges } =
        request.query;

      // Validate required params
      if (!q || q.trim().length === 0) {
        return reply.code(400).send({ error: "Query parameter 'q' is required" });
      }

      // Parse optional params
      const parsedLat = lat ? parseFloat(lat) : undefined;
      const parsedLng = lng ? parseFloat(lng) : undefined;
      const parsedLimit = limit ? parseInt(limit, 10) : 20;

      // Parse bounds: "minLng,minLat,maxLng,maxLat"
      let parsedBounds: [number, number, number, number] | undefined;
      if (bounds) {
        const parts = bounds.split(",").map(parseFloat);
        if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
          parsedBounds = parts as [number, number, number, number];
        }
      }

      // Get user ID from optional auth
      const userId = request.user?.id;

      try {
        const results = await unifiedSearch({
          query: q.trim(),
          lat: parsedLat,
          lng: parsedLng,
          bounds: parsedBounds,
          limit: Math.min(parsedLimit, 100), // Cap at 100
          includePeaks: includePeaks !== "false",
          includeChallenges: includeChallenges !== "false",
          userId,
        });

        reply.code(200).send(results);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: "Search failed" });
      }
    }
  );

  done();
};

export default search;
