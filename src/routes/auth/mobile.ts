import { FastifyInstance } from "fastify";
import StravaTokenResponse from "../../typeDefs/StravaTokenResponse";
import updateStravaCreds from "../../helpers/updateStravaCreds";
import createUser from "../../helpers/user/createUser";
import addUserData from "../../helpers/user/addUserData";
import getUser from "../../helpers/user/getUser";
import { mintMobileToken, mintAccessTokenFromRefresh } from "../../helpers/auth";
import { verifyMobileRefreshToken } from "../../helpers/auth/verifyMobileToken";

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? "";
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? "";

// Demo login credentials for Google Play review
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";
const DEMO_USER_ID = process.env.DEMO_USER_ID ?? "demo-reviewer";

interface StravaAthleteResponse {
    id: number;
    username: string | null;
    firstname: string;
    lastname: string;
    profile: string;
    profile_medium: string;
    city: string | null;
    state: string | null;
    country: string | null;
}

interface StravaOAuthResponse extends StravaTokenResponse {
    athlete: StravaAthleteResponse;
}

/**
 * Exchange Strava authorization code for tokens.
 * Supports both PKCE (mobile endpoint) and standard OAuth (web redirect).
 */
const exchangeStravaCode = async (
    code: string,
    codeVerifier?: string
): Promise<StravaOAuthResponse | null> => {
    const params: Record<string, string> = {
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
    };
    
    // Only include code_verifier if provided (for PKCE flow)
    if (codeVerifier) {
        params.code_verifier = codeVerifier;
    }

    const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Strava token exchange failed:", response.status, errorText);
        return null;
    }

    return response.json();
};

const mobileAuth = (fastify: FastifyInstance, _: any, done: any) => {
    /**
     * POST /api/auth/mobile/strava/exchange
     * 
     * Exchange Strava authorization code for PathQuest session tokens.
     * This endpoint handles:
     * 1. PKCE code exchange with Strava
     * 2. User creation/update in PathQuest database
     * 3. Strava token storage
     * 4. PathQuest session token minting
     */
    fastify.post<{
        Body: {
            code: string;
            codeVerifier?: string; // Optional - only needed for PKCE flow
            redirectUri?: string; // Not required but may be sent
        };
    }>("/strava/exchange", async (request, reply) => {
        const { code, codeVerifier } = request.body;

        // Validate required fields
        if (!code || typeof code !== "string") {
            reply.code(400).send({ message: "Missing or invalid code" });
            return;
        }

        // Exchange code with Strava (codeVerifier is optional for non-PKCE flows)
        const stravaResponse = await exchangeStravaCode(code, codeVerifier);
        if (!stravaResponse) {
            reply.code(401).send({ message: "Failed to exchange code with Strava" });
            return;
        }

        const { athlete, access_token, refresh_token, expires_at } = stravaResponse;
        const userId = String(athlete.id);
        const name = `${athlete.firstname} ${athlete.lastname}`.trim();
        const pic = athlete.profile || athlete.profile_medium || null;

        // Check if user exists
        let existingUser = await getUser(userId);

        if (!existingUser) {
            // Create new user
            await createUser({ id: userId, name, email: null });
            
            // Add user data from Strava
            await addUserData({
                id: userId,
                name,
                email: null,
                token: access_token,
            });
        }

        // Store/update Strava credentials
        await updateStravaCreds({
            provider_account_id: userId,
            access_token,
            refresh_token,
            expires_at,
        });

        // Fetch updated user data
        const user = await getUser(userId);
        if (!user) {
            fastify.log.error("Failed to fetch user after creation/update");
            reply.code(500).send({ message: "Internal server error" });
            return;
        }

        // Mint PathQuest session tokens
        const tokens = mintMobileToken({
            sub: userId,
            email: user.email,
            name: user.name,
            isPublic: user.is_public,
        });

        reply.code(200).send({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                pic: user.pic,
                city: user.city,
                state: user.state,
                country: user.country,
                isPublic: user.is_public,
            },
        });
    });

    /**
     * POST /api/auth/mobile/refresh
     * 
     * Refresh an expired access token using a valid refresh token.
     * Returns a new access token without requiring re-authentication with Strava.
     */
    fastify.post<{
        Body: {
            refreshToken: string;
        };
    }>("/refresh", async (request, reply) => {
        const { refreshToken } = request.body;

        // Validate required fields
        if (!refreshToken || typeof refreshToken !== "string") {
            reply.code(400).send({ message: "Missing or invalid refreshToken" });
            return;
        }

        // Verify the refresh token
        const decoded = verifyMobileRefreshToken(refreshToken);
        if (!decoded) {
            reply.code(401).send({ message: "Invalid or expired refresh token" });
            return;
        }

        const userId = decoded.sub;

        // Fetch current user data to include in new access token
        const user = await getUser(userId);
        if (!user) {
            reply.code(401).send({ message: "User not found" });
            return;
        }

        // Mint new access token
        const { accessToken, expiresAt } = mintAccessTokenFromRefresh(userId, {
            email: user.email,
            name: user.name,
            isPublic: user.is_public,
        });

        reply.code(200).send({
            accessToken,
            expiresAt,
        });
    });

    /**
     * POST /api/auth/mobile/demo-login
     * 
     * Demo login endpoint for Google Play reviewers.
     * Bypasses Strava OAuth and returns tokens for a pre-configured demo user.
     * Requires a secret password to prevent abuse.
     */
    fastify.post<{
        Body: {
            password: string;
        };
    }>("/demo-login", async (request, reply) => {
        const { password } = request.body;

        // Validate password
        if (!password || typeof password !== "string") {
            reply.code(400).send({ message: "Missing or invalid password" });
            return;
        }

        // Check if demo login is configured
        if (!DEMO_USER_PASSWORD) {
            reply.code(503).send({ message: "Demo login is not configured" });
            return;
        }

        // Verify password (constant-time comparison would be better but this is fine for a demo)
        if (password !== DEMO_USER_PASSWORD) {
            reply.code(401).send({ message: "Invalid credentials" });
            return;
        }

        // Fetch or create demo user
        let user = await getUser(DEMO_USER_ID);
        
        if (!user) {
            // Create the demo user if it doesn't exist
            await createUser({ 
                id: DEMO_USER_ID, 
                name: "Demo Reviewer", 
                email: "demo@pathquest.app" 
            });
            user = await getUser(DEMO_USER_ID);
        }

        if (!user) {
            fastify.log.error("Failed to create or fetch demo user");
            reply.code(500).send({ message: "Internal server error" });
            return;
        }

        // Mint PathQuest session tokens
        const tokens = mintMobileToken({
            sub: DEMO_USER_ID,
            email: user.email,
            name: user.name,
            isPublic: user.is_public,
        });

        reply.code(200).send({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                pic: user.pic,
                city: user.city,
                state: user.state,
                country: user.country,
                isPublic: user.is_public,
            },
        });
    });

    done();
};

export default mobileAuth;

