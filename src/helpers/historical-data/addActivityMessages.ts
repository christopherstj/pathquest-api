import dayjs from "dayjs";
import ListActivity from "../../typeDefs/ListActivity";
import QueueMessage from "../../typeDefs/QueueMessage";
import getCloudSqlConnection from "../getCloudSqlConnection";
import StravaEvent from "../../typeDefs/StravaEvent";
import mysql from "mysql2/promise";

const subscriptionId = process.env.STRAVA_SUBSCRIPTION_ID ?? "";

const addActivityMessages = async (activities: ListActivity[]) => {
    const connection = await getCloudSqlConnection();

    await connection.query(
        `INSERT INTO EventQueue (\`action\`, created, jsonData, isWebhook) VALUES ?`,
        [
            activities.map((activity) => {
                const event: StravaEvent = {
                    aspect_type: "create",
                    event_time: dayjs(activity.start_date).unix(),
                    object_id: activity.id,
                    object_type: "activity",
                    owner_id: activity.athlete.id,
                    subscription_id: parseInt(subscriptionId),
                };
                const message: QueueMessage = {
                    action: "create",
                    created: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                    jsonData: JSON.stringify(event),
                    isWebhook: false,
                };
                return [
                    message.action,
                    message.created,
                    message.jsonData,
                    message.isWebhook,
                ];
            }),
        ]
    );
};

export default addActivityMessages;
