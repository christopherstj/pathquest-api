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
 * Exchange Strava authorization code for tokens using PKCE.
 * This is the entry point for mobile app authentication.
 */
const exchangeStravaCode = async (
    code: string,
    codeVerifier: string
): Promise<StravaOAuthResponse | null> => {
    const params = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
    });

    const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
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
            codeVerifier: string;
            redirectUri?: string; // Not required for PKCE but may be sent
        };
    }>("/strava/exchange", async (request, reply) => {
        const { code, codeVerifier } = request.body;

        // Validate required fields
        if (!code || typeof code !== "string") {
            reply.code(400).send({ message: "Missing or invalid code" });
            return;
        }
        if (!codeVerifier || typeof codeVerifier !== "string") {
            reply.code(400).send({ message: "Missing or invalid codeVerifier" });
            return;
        }

        // Exchange code with Strava
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

    done();
};

export default mobileAuth;

