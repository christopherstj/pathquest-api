import dayjs from "dayjs";
import ListActivity from "../../typeDefs/ListActivity";
import QueueMessage from "../../typeDefs/QueueMessage";
import getCloudSqlConnection from "../getCloudSqlConnection";
import StravaEvent from "../../typeDefs/StravaEvent";

const subscriptionId = process.env.STRAVA_SUBSCRIPTION_ID ?? "";

const addActivityMessages = async (
    activities: ListActivity[],
    userId: string
) => {
    const db = await getCloudSqlConnection();

    // Build the values placeholders
    const valueGroups: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    activities.forEach((activity) => {
        const event: StravaEvent = {
            aspect_type: "create",
            event_time: dayjs(activity.start_date).unix(),
            object_id: activity.id,
            object_type: "activity",
            owner_id: activity.athlete.id,
            subscription_id: parseInt(subscriptionId),
        };
        const message: QueueMessage = {
            user_id: userId,
            action: "create",
            created: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            json_data: JSON.stringify(event),
            is_webhook: false,
        };

        valueGroups.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${
                paramIndex + 3
            }, $${paramIndex + 4})`
        );
        params.push(
            userId,
            message.action,
            message.created,
            message.json_data,
            message.is_webhook
        );
        paramIndex += 5;
    });

    if (valueGroups.length > 0) {
        await db.query(
            `INSERT INTO event_queue (user_id, action, created, json_data, is_webhook) VALUES ${valueGroups.join(
                ", "
            )}`,
            params
        );
    }
};

export default addActivityMessages;
