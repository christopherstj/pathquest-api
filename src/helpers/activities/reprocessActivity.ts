import dayjs from "dayjs";
import StravaEvent from "../../typeDefs/StravaEvent";
import checkRateLimit from "../checkRateLimit";
import QueueMessage from "../../typeDefs/QueueMessage";
import addEventToQueue from "../addEventToQueue";
import { PubSub } from "@google-cloud/pubsub";
import setReprocessingStatus from "./setReprocessingStatus";
import getReprocessingStatus from "./getReprocessingStatus";

const subscriptionId = process.env.STRAVA_SUBSCRIPTION_ID ?? "";
const topicName = process.env.PUBSUB_TOPIC ?? "";

const pubSubClient = new PubSub();

const reprocessActivity = async (activityId: number, userId: string) => {
    console.log("Reprocessing activity " + activityId);
    try {
        const reprocessingStatus = await getReprocessingStatus(
            activityId.toString()
        );

        if (reprocessingStatus) {
            console.log(
                "Activity " + activityId + " is already being reprocessed"
            );
            return { success: false };
        }

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
            user_id: userId,
            action: "create",
            created: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            json_data: JSON.stringify(newEvent),
            is_webhook: false,
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

        await setReprocessingStatus(activityId.toString(), true);

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
