import QueueMessage from "../typeDefs/QueueMessage";
import getCloudSqlConnection from "./getCloudSqlConnection";

const addEventToQueue = async (message: QueueMessage) => {
    const db = await getCloudSqlConnection();
    await db.query(
        `INSERT INTO event_queue (action, created, json_data, is_webhook, user_id, priority) VALUES ($1, $2, $3, $4, $5, 1)`,
        [
            message.action,
            message.created,
            message.json_data,
            message.is_webhook,
            message.user_id,
        ]
    );
};

export default addEventToQueue;
