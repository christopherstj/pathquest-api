import jwt from "jsonwebtoken";

export type MobileTokenPayload = {
    sub: string; // userId
    email?: string | null;
    name?: string | null;
    isPublic?: boolean | null;
};

export type MobileTokens = {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp in seconds
};

const MOBILE_SECRET = process.env.PATHQUEST_MOBILE_SECRET ?? "";
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "30d"; // 30 days

/**
 * Mints access and refresh tokens for mobile clients.
 * Access tokens are short-lived (15 min), refresh tokens are long-lived (30 days).
 */
const mintMobileToken = (payload: MobileTokenPayload): MobileTokens => {
    if (!MOBILE_SECRET) {
        throw new Error("PATHQUEST_MOBILE_SECRET environment variable is not set");
    }

    const accessToken = jwt.sign(
        {
            sub: payload.sub,
            email: payload.email,
            name: payload.name,
            is_public: payload.isPublic,
            type: "access",
        },
        MOBILE_SECRET,
        {
            expiresIn: ACCESS_TOKEN_EXPIRY,
            issuer: "pathquest-mobile",
        }
    );

    const refreshToken = jwt.sign(
        {
            sub: payload.sub,
            type: "refresh",
        },
        MOBILE_SECRET,
        {
            expiresIn: REFRESH_TOKEN_EXPIRY,
            issuer: "pathquest-mobile",
        }
    );

    // Calculate expiry timestamp (15 minutes from now)
    const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;

    return {
        accessToken,
        refreshToken,
        expiresAt,
    };
};

/**
 * Mints a new access token from a refresh token payload.
 * Used when refreshing an expired access token.
 */
export const mintAccessTokenFromRefresh = (
    userId: string,
    userDetails: { email?: string | null; name?: string | null; isPublic?: boolean | null }
): { accessToken: string; expiresAt: number } => {
    if (!MOBILE_SECRET) {
        throw new Error("PATHQUEST_MOBILE_SECRET environment variable is not set");
    }

    const accessToken = jwt.sign(
        {
            sub: userId,
            email: userDetails.email,
            name: userDetails.name,
            is_public: userDetails.isPublic,
            type: "access",
        },
        MOBILE_SECRET,
        {
            expiresIn: ACCESS_TOKEN_EXPIRY,
            issuer: "pathquest-mobile",
        }
    );

    const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;

    return { accessToken, expiresAt };
};

export default mintMobileToken;

