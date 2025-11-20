import { StravaCreds } from "../typeDefs/StravaCreds";
import getCloudSqlConnection from "./getCloudSqlConnection";

const updateStravaCreds = async (stravaCreds: StravaCreds) => {
    const db = await getCloudSqlConnection();
    const { provider_account_id, access_token, refresh_token, expires_at } =
        stravaCreds;

    await db.query(
        "INSERT INTO strava_tokens (user_id, access_token, refresh_token, access_token_expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET access_token = $2, refresh_token = $3, access_token_expires_at = $4",
        [provider_account_id, access_token, refresh_token, expires_at]
    );
};

export default updateStravaCreds;
