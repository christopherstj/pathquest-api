import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import authPlugin from "../../plugins/auth";

describe("auth plugin header identity", () => {
    it("allows header-based user id without JWT", async () => {
        const app = Fastify();
        await app.register(authPlugin);

        app.get("/private", { onRequest: [app.authenticate] }, async (req) => {
            return { user: req.user };
        });

        const res = await app.inject({
            method: "GET",
            url: "/private",
            headers: {
                authorization: "Bearer opaque",
                "x-user-id": "test-user",
                "x-user-email": "t@example.com",
                "x-user-name": "Test User",
                "x-user-public": "true",
            },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
            user: {
                id: "test-user",
                email: "t@example.com",
                name: "Test User",
                isPublic: true,
            },
        });
    });

    it("fails auth when no token and no header identity", async () => {
        const app = Fastify();
        await app.register(authPlugin);

        app.get("/private", { onRequest: [app.authenticate] }, async (req) => {
            return { user: req.user };
        });

        const res = await app.inject({
            method: "GET",
            url: "/private",
        });

        expect(res.statusCode).toBe(401);
    });
});

