import { StravaCreds } from "../typeDefs/StravaCreds";
import db from "./getCloudSqlConnection";

const updateStravaCreds = async (stravaCreds: StravaCreds) => {
    const { providerAccountId, accessToken, refreshToken, expiresAt } =
        stravaCreds;

    await db.execute(
        "INSERT INTO StravaToken (userId, accessToken, refreshToken, accessTokenExpiresAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE accessToken = ?, refreshToken = ?, accessTokenExpiresAt = ?",
        [
            providerAccountId,
            accessToken,
            refreshToken,
            expiresAt,
            accessToken,
            refreshToken,
            expiresAt,
        ]
    );
};

export default updateStravaCreds;
