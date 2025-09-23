import QueueMessage from "../typeDefs/QueueMessage";
import db from "./getCloudSqlConnection";

const addEventToQueue = async (message: QueueMessage) => {
    await db.execute(
        `INSERT INTO EventQueue (\`action\`, created, jsonData, isWebhook, userId, priority) VALUES (?, ?, ?, ?, ?, 1)`,
        [
            message.action,
            message.created,
            message.jsonData,
            message.isWebhook,
            message.userId,
        ]
    );
};

export default addEventToQueue;
