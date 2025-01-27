import dayjs from "dayjs";
import StravaEvent from "../../typeDefs/StravaEvent";
import checkRateLimit from "../checkRateLimit";
import QueueMessage from "../../typeDefs/QueueMessage";
import addEventToQueue from "../addEventToQueue";
import { PubSub } from "@google-cloud/pubsub";

const subscriptionId = process.env.STRAVA_SUBSCRIPTION_ID ?? "";
const topicName = process.env.PUBSUB_TOPIC ?? "";

const pubSubClient = new PubSub();

const reprocessActivity = async (activityId: number, userId: string) => {
    try {
        const newEvent: StravaEvent = {
            aspect_type: "create",
            event_time: dayjs().unix(),
            owner_id: parseInt(userId),
            object_id: activityId,
            object_type: "activity",
            subscription_id: parseInt(subscriptionId),
            updates: {},
        };

        const message: QueueMessage = {
            userId,
            action: "create",
            created: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            jsonData: JSON.stringify(newEvent),
            isWebhook: false,
        };

        const processNow = await checkRateLimit();

        if (processNow) {
            const data = JSON.stringify(message);
            const dataBuffer = Buffer.from(data);
            const publisher = pubSubClient.topic(topicName);

            await publisher.publishMessage({ data: dataBuffer });
        } else {
            await addEventToQueue(message);
        }

        return { success: true };
    } catch (err) {
        console.error(
            "Failed to reprocess activity " + activityId,
            (err as Error).message
        );
        return { success: false };
    }
};

export default reprocessActivity;
