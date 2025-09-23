import dayjs from "dayjs";
import ListActivity from "../../typeDefs/ListActivity";
import QueueMessage from "../../typeDefs/QueueMessage";
import db from "../getCloudSqlConnection";
import StravaEvent from "../../typeDefs/StravaEvent";
import mysql from "mysql2/promise";

const subscriptionId = process.env.STRAVA_SUBSCRIPTION_ID ?? "";

const addActivityMessages = async (
    activities: ListActivity[],
    userId: string
) => {
    await db.query(
        `INSERT INTO EventQueue (userId, \`action\`, created, jsonData, isWebhook) VALUES ?`,
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
                    userId,
                    action: "create",
                    created: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                    jsonData: JSON.stringify(event),
                    isWebhook: false,
                };
                return [
                    userId,
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
