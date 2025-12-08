import fp from "fastify-plugin";
import { decode } from "next-auth/jwt";
import { FastifyReply, FastifyRequest } from "fastify";

type AuthenticatedUser = {
    id: string;
    email?: string | null;
    name?: string | null;
    isPublic?: boolean | null;
};

declare module "fastify" {
    interface FastifyRequest {
        user?: AuthenticatedUser;
    }

    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

const getBearerToken = (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    return header.replace("Bearer ", "").trim();
};

const decodeToken = async (token: string) => {
    return decode({
        token,
        secret: process.env.JWT_SECRET ?? "",
    });
};

const buildUser = (decoded: any): AuthenticatedUser | null => {
    if (!decoded?.sub) {
        return null;
    }

    return {
        id: String(decoded.sub),
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        isPublic: decoded.is_public ?? null,
    };
};

const buildUserFromHeaders = (request: FastifyRequest): AuthenticatedUser | null => {
    const userId = request.headers["x-user-id"];
    if (!userId) return null;
    const email = request.headers["x-user-email"];
    const name = request.headers["x-user-name"];
    const isPublicHeader = request.headers["x-user-public"];
    const isPublic =
        typeof isPublicHeader === "string"
            ? isPublicHeader.toLowerCase() === "true"
            : undefined;

    return {
        id: Array.isArray(userId) ? userId[0] : String(userId),
        email: Array.isArray(email) ? email[0] : email,
        name: Array.isArray(name) ? name[0] : name,
        isPublic,
    };
};

const authPlugin = fp(async (fastify, _opts) => {
    fastify.decorateRequest("user");

    fastify.decorate(
        "authenticate",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const token = getBearerToken(request);
            const headerUser = buildUserFromHeaders(request);

            if (!token && !headerUser) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            if (headerUser) {
                request.user = headerUser;
                return;
            }

            try {
                const decoded = await decodeToken(token!);
                const user = buildUser(decoded);

                if (!user) {
                    reply.code(401).send({ message: "Unauthorized" });
                    return;
                }

                request.user = user;
            } catch (error) {
                fastify.log.error(error);
                reply.code(401).send({ message: "Unauthorized" });
            }
        }
    );

    fastify.decorate(
        "optionalAuth",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const token = getBearerToken(request);
            const headerUser = buildUserFromHeaders(request);

            if (headerUser) {
                request.user = headerUser;
                return;
            }

            if (!token) {
                return;
            }

            try {
                const decoded = await decodeToken(token);
                const user = buildUser(decoded);

                if (user) {
                    request.user = user;
                }
            } catch (error) {
                fastify.log.warn(
                    { err: error },
                    "Failed to decode optional authorization token"
                );
                // optional auth does not block the request
            }
        }
    );

    fastify.setErrorHandler((error, request, reply) => {
        if (error.statusCode && error.statusCode < 500) {
            reply.status(error.statusCode).send({ message: error.message });
            return;
        }

        fastify.log.error({ err: error, url: request.url }, "Unhandled error");
        reply.status(500).send({ message: "Internal server error" });
    });
});

export default authPlugin;

