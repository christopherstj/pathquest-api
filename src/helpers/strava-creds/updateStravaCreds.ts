import { StravaCreds } from "../../typeDefs/StravaCreds";
import getCloudSqlConnection from "../getCloudSqlConnection";

const updateStravaCreds = async (stravaCreds: StravaCreds) => {
    const connection = await getCloudSqlConnection();

    console.log("stravaCreds: ", stravaCreds);

    const { providerAccountId, access_token, refresh_token, expires_at } =
        stravaCreds;

    await connection.execute(
        "INSERT INTO StravaToken (userId, accessToken, refreshToken, accessTokenExpiresAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE accessToken = ?, refreshToken = ?, accessTokenExpiresAt = ?",
        [
            providerAccountId,
            access_token,
            refresh_token,
            expires_at,
            access_token,
            refresh_token,
            expires_at,
        ]
    );

    await connection.end();
};

export default updateStravaCreds;
