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

/**
 * Checks if a token is a Google ID token (not a NextAuth JWT).
 * Google ID tokens have an 'iss' field that's a Google domain or service account email.
 */
const isGoogleIdToken = (token: string): boolean => {
    try {
        // Decode without verification to check the issuer
        const parts = token.split(".");
        if (parts.length !== 3) return false;
        
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        const issuer = payload.iss;
        
        // Google ID tokens have issuers like:
        // - https://accounts.google.com
        // - service-account@project.iam.gserviceaccount.com
        // - https://oidc.vercel.com (Vercel OIDC, but these get exchanged for Google tokens)
        return (
            typeof issuer === "string" &&
            (issuer.includes("google.com") ||
             issuer.includes("gserviceaccount.com") ||
             issuer.startsWith("https://accounts.google.com"))
        );
    } catch {
        return false;
    }
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
    const nameHeader = request.headers["x-user-name"];
    const isPublicHeader = request.headers["x-user-public"];
    const isPublic =
        typeof isPublicHeader === "string"
            ? isPublicHeader.toLowerCase() === "true"
            : undefined;

    // Decode URL-encoded name (handles emojis and non-ASCII characters)
    const rawName = Array.isArray(nameHeader) ? nameHeader[0] : nameHeader;
    let name: string | undefined;
    if (rawName) {
        try {
            name = decodeURIComponent(rawName);
        } catch {
            // If decoding fails, use the raw value
            name = rawName;
        }
    }

    return {
        id: Array.isArray(userId) ? userId[0] : String(userId),
        email: Array.isArray(email) ? email[0] : email,
        name,
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

            // Google ID tokens can't be decoded as NextAuth JWTs
            // They're validated by Google IAM, but we need x-user-* headers for user info
            if (isGoogleIdToken(token!)) {
                fastify.log.warn(
                    "Google ID token provided without x-user-* headers - cannot determine user identity"
                );
                reply.code(401).send({ message: "Unauthorized" });
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

            // Skip NextAuth decoding for Google ID tokens (they're validated by Google IAM)
            if (isGoogleIdToken(token)) {
                // Google IAM validates the token, but we can't extract user info from it
                // User info should come from x-user-* headers instead
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

