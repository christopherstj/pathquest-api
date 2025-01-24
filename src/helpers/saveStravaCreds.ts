import { StravaCredsDb } from "../typeDefs/StravaCredsDb";
import getCloudSqlConnection from "./getCloudSqlConnection";

const saveStravaCreds = async (creds: StravaCredsDb) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const { userId, accessToken, refreshToken, accessTokenExpiresAt } = creds;

    await connection.execute(
        "INSERT INTO StravaToken (userId, accessToken, refreshToken, accessTokenExpiresAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE accessToken = ?, refreshToken = ?, accessTokenExpiresAt = ?",
        [
            userId,
            accessToken,
            refreshToken,
            accessTokenExpiresAt,
            accessToken,
            refreshToken,
            accessTokenExpiresAt,
        ]
    );

    connection.release();
};

export default saveStravaCreds;
