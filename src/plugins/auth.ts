import fp from "fastify-plugin";
import { decode } from "next-auth/jwt";
import { FastifyReply, FastifyRequest } from "fastify";
import { isPathQuestMobileToken, verifyMobileAccessToken } from "../helpers/auth";

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

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

const getBearerToken = (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    return header.replace("Bearer ", "").trim();
};

/**
 * Checks if a token is a Google ID token (not a NextAuth JWT or PathQuest mobile token).
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

const decodeNextAuthToken = async (token: string) => {
    return decode({
        token,
        secret: process.env.NEXTAUTH_SECRET ?? "",
    });
};

const buildUserFromNextAuth = (decoded: any): AuthenticatedUser | null => {
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

const buildUserFromMobileToken = (decoded: ReturnType<typeof verifyMobileAccessToken>): AuthenticatedUser | null => {
    if (!decoded?.sub) {
        return null;
    }

    return {
        id: decoded.sub,
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        isPublic: decoded.is_public ?? null,
    };
};

/**
 * Build user from x-user-* headers.
 * NOTE: This is only allowed in development mode for security reasons.
 * In production, all requests must use verified tokens.
 */
const buildUserFromHeaders = (request: FastifyRequest): AuthenticatedUser | null => {
    // SECURITY: Header-based auth is only allowed in development
    if (!IS_DEVELOPMENT) {
        return null;
    }

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

/**
 * Attempts to authenticate a token, trying multiple strategies in order:
 * 1. PathQuest Mobile token (if issuer is "pathquest-mobile")
 * 2. NextAuth JWT (default for web clients)
 * 
 * Google ID tokens are rejected (legacy Vercel OIDC flow, no longer supported).
 */
const authenticateToken = async (token: string, fastify: any): Promise<AuthenticatedUser | null> => {
    // Debug: log token info
    fastify.log.info(`[Auth] Token received, length: ${token.length}, starts with: ${token.substring(0, 20)}...`);
    fastify.log.info(`[Auth] NEXTAUTH_SECRET set: ${!!process.env.NEXTAUTH_SECRET}, length: ${process.env.NEXTAUTH_SECRET?.length ?? 0}`);

    // Try PathQuest mobile token first
    if (isPathQuestMobileToken(token)) {
        fastify.log.info("[Auth] Detected PathQuest mobile token");
        const decoded = verifyMobileAccessToken(token);
        if (decoded) {
            return buildUserFromMobileToken(decoded);
        }
        fastify.log.warn("Invalid PathQuest mobile token");
        return null;
    }

    // Reject Google ID tokens (legacy Vercel OIDC flow)
    if (isGoogleIdToken(token)) {
        fastify.log.warn("Google ID tokens are no longer supported - use NextAuth JWT or PathQuest mobile token");
        return null;
    }

    // Try NextAuth JWT
    fastify.log.info("[Auth] Attempting NextAuth JWT decode");
    try {
        const decoded = await decodeNextAuthToken(token);
        fastify.log.info(`[Auth] NextAuth decode result: ${decoded ? 'success' : 'null'}, sub: ${decoded?.sub}`);
        const user = buildUserFromNextAuth(decoded);
        if (!user) {
            fastify.log.warn("[Auth] buildUserFromNextAuth returned null");
        }
        return user;
    } catch (error) {
        fastify.log.error({ err: error }, "[Auth] Failed to decode NextAuth token");
        return null;
    }
};

const authPlugin = fp(async (fastify, _opts) => {
    fastify.decorateRequest("user");

    fastify.decorate(
        "authenticate",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const token = getBearerToken(request);
            
            // In development only, allow header-based auth
            const headerUser = buildUserFromHeaders(request);
            if (headerUser) {
                request.user = headerUser;
                return;
            }

            if (!token) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            const user = await authenticateToken(token, fastify);
            if (!user) {
                reply.code(401).send({ message: "Unauthorized" });
                return;
            }

            request.user = user;
        }
    );

    fastify.decorate(
        "optionalAuth",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const token = getBearerToken(request);

            // In development only, allow header-based auth
            const headerUser = buildUserFromHeaders(request);
            if (headerUser) {
                request.user = headerUser;
                return;
            }

            if (!token) {
                return;
            }

            const user = await authenticateToken(token, fastify);
            if (user) {
                request.user = user;
            }
            // Optional auth does not block the request even if token is invalid
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
