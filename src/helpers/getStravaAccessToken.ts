import StravaTokenResponse from "../typeDefs/StravaTokenResponse";
import { ResultSetHeader } from "mysql2/promise";
import updateStravaCreds from "./updateStravaCreds";
import getCloudSqlConnection from "./getCloudSqlConnection";
import { StravaCredsDb } from "../typeDefs/StravaCredsDb";

const clientId = process.env.STRAVA_CLIENT_ID ?? "";
const clientSecret = process.env.STRAVA_CLIENT_SECRET ?? "";

const getNewToken = async (refreshToken: string, userId: string) => {
    const response = await fetch(
        `https://www.strava.com/api/v3/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}&grant_type=refresh_token`,
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        console.error("Failed to get new token", await response.text());
        return null;
    }

    const data: StravaTokenResponse = await response.json();

    await updateStravaCreds({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        provider_account_id: userId,
    });

    return data.access_token;
};

const getStravaAccessToken = async (userId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `SELECT * FROM strava_tokens WHERE user_id = $1 LIMIT 1`,
            [userId]
        )
    ).rows as (StravaCredsDb & ResultSetHeader)[];

    if (rows.length === 0) {
        console.error("No strava creds found for user", userId);
        return null;
    } else {
        const creds = rows[0];

        const { access_token, refresh_token, access_token_expires_at } = creds;

        if (!refresh_token || refresh_token === "") {
            return null;
        } else if (!access_token || access_token === "") {
            return await getNewToken(refresh_token, userId);
        } else if (
            access_token_expires_at &&
            access_token_expires_at * 1000 < new Date().getTime()
        ) {
            return await getNewToken(refresh_token, userId);
        } else {
            return access_token;
        }
    }
};

export default getStravaAccessToken;
