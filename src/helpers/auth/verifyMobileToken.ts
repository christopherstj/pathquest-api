import jwt from "jsonwebtoken";

export type VerifiedMobileToken = {
    sub: string;
    email?: string | null;
    name?: string | null;
    is_public?: boolean | null;
    type: "access" | "refresh";
    iss: string;
    iat: number;
    exp: number;
};

const MOBILE_SECRET = process.env.PATHQUEST_MOBILE_SECRET ?? "";

/**
 * Checks if a token is a PathQuest mobile token (not NextAuth or Google).
 * Mobile tokens have issuer "pathquest-mobile".
 */
export const isPathQuestMobileToken = (token: string): boolean => {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return false;

        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        return payload.iss === "pathquest-mobile";
    } catch {
        return false;
    }
};

/**
 * Verifies a PathQuest mobile access token and returns the decoded payload.
 * Throws if the token is invalid, expired, or not an access token.
 */
export const verifyMobileAccessToken = (token: string): VerifiedMobileToken | null => {
    if (!MOBILE_SECRET) {
        console.error("PATHQUEST_MOBILE_SECRET environment variable is not set");
        return null;
    }

    try {
        const decoded = jwt.verify(token, MOBILE_SECRET, {
            issuer: "pathquest-mobile",
        }) as VerifiedMobileToken;

        // Ensure it's an access token, not a refresh token
        if (decoded.type !== "access") {
            console.warn("Token is not an access token");
            return null;
        }

        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            console.warn("Mobile token expired");
        } else if (error instanceof jwt.JsonWebTokenError) {
            console.warn("Invalid mobile token:", error.message);
        } else {
            console.error("Error verifying mobile token:", error);
        }
        return null;
    }
};

/**
 * Verifies a PathQuest mobile refresh token and returns the decoded payload.
 * Throws if the token is invalid, expired, or not a refresh token.
 */
export const verifyMobileRefreshToken = (token: string): VerifiedMobileToken | null => {
    if (!MOBILE_SECRET) {
        console.error("PATHQUEST_MOBILE_SECRET environment variable is not set");
        return null;
    }

    try {
        const decoded = jwt.verify(token, MOBILE_SECRET, {
            issuer: "pathquest-mobile",
        }) as VerifiedMobileToken;

        // Ensure it's a refresh token
        if (decoded.type !== "refresh") {
            console.warn("Token is not a refresh token");
            return null;
        }

        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            console.warn("Mobile refresh token expired");
        } else if (error instanceof jwt.JsonWebTokenError) {
            console.warn("Invalid mobile refresh token:", error.message);
        } else {
            console.error("Error verifying mobile refresh token:", error);
        }
        return null;
    }
};

export default verifyMobileAccessToken;

