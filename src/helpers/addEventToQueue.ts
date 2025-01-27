import QueueMessage from "../typeDefs/QueueMessage";
import getCloudSqlConnection from "./getCloudSqlConnection";

const addEventToQueue = async (message: QueueMessage) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.execute(
        `INSERT INTO EventQueue (\`action\`, created, jsonData, isWebhook, userId) VALUES (?, ?, ?, ?, ?)`,
        [
            message.action,
            message.created,
            message.jsonData,
            message.isWebhook,
            message.userId,
        ]
    );

    connection.release();
};

export default addEventToQueue;
