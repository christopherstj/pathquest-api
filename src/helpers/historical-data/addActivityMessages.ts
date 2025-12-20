import dayjs from "dayjs";
import ListActivity from "../../typeDefs/ListActivity";
import QueueMessage from "../../typeDefs/QueueMessage";
import getCloudSqlConnection from "../getCloudSqlConnection";
import StravaEvent from "../../typeDefs/StravaEvent";

const subscriptionId = process.env.STRAVA_SUBSCRIPTION_ID ?? "";

// Sport types that never have GPS data or are not relevant to peak bagging
// These activities are filtered at import time to save API calls
const SKIP_SPORT_TYPES = [
    // Indoor activities (no GPS)
    "Yoga",
    "WeightTraining",
    "Workout",
    "Crossfit",
    "Elliptical",
    "StairStepper",
    "Rowing",
    "Swim",
    "VirtualRide",
    "VirtualRun",
    "VirtualRow",

    // Already skipped in activity-worker, but filter here to save API calls
    "AlpineSki",
    "Snowboard",
    "Golf",
    "Sail",
    "Windsurf",
    "Kitesurf",
    "Velomobile",

    // Other non-peak activities
    "Handcycle",
    "Wheelchair",
    "Soccer",
    "Skateboard",
    "InlineSkate",
    "IceSkate",
    "Surfing",
    "StandUpPaddling",
    "Badminton",
    "Tennis",
    "Pickleball",
    "Squash",
    "TableTennis",
    "RollerSki",
];

/**
 * Calculate priority score for an activity based on likelihood of having summits.
 * Lower number = higher priority = processed first.
 *
 * Webhooks get priority 1.
 * Historical activities get priority 100-1100 based on:
 * - Elevation gain (higher = more likely to have peaks)
 * - Distance (longer = more exploration)
 * - Recency (recent activities get slight boost)
 */
const calculatePriority = (activity: ListActivity): number => {
    // Base priority for historical activities
    let priority = 1000;

    // Elevation gain: more gain = lower priority number = processed first
    // Cap at 3000m (~10,000ft) to avoid overflow
    const gainMeters = Math.min(activity.total_elevation_gain || 0, 3000);
    priority -= gainMeters * 0.3; // 3000m gain = -900 priority

    // Distance: longer = more likely to summit something
    // Cap at 50km to avoid overflow
    const distanceKm = Math.min((activity.distance || 0) / 1000, 50);
    priority -= distanceKm * 1; // 50km = -50 priority

    // Recency: recent activities get slight boost (for user engagement)
    const daysAgo = dayjs().diff(dayjs(activity.start_date), "day");
    priority += Math.min(daysAgo * 0.05, 100); // Max +100 for very old activities

    // Clamp to range [100, 1100] - above webhooks (priority 1)
    return Math.max(Math.floor(priority), 100);
};

/**
 * Check if an activity should be skipped at import time.
 * Filters out activities that will never have summits.
 */
const shouldSkipActivity = (activity: ListActivity): boolean => {
    // Skip if sport type is in the exclusion list
    if (SKIP_SPORT_TYPES.includes(activity.sport_type)) {
        return true;
    }

    // Skip if no GPS data (no summary_polyline means no coordinates)
    if (!activity.map?.summary_polyline) {
        return true;
    }

    // Skip activities with distance less than 100 meters (likely GPS glitches or indoor)
    if (activity.distance < 100) {
        return true;
    }

    return false;
};

const addActivityMessages = async (
    activities: ListActivity[],
    userId: string
) => {
    const db = await getCloudSqlConnection();

    // Filter out activities that will never have summits
    const validActivities = activities.filter(
        (activity) => !shouldSkipActivity(activity)
    );

    console.log(
        `Filtered ${activities.length - validActivities.length} of ${activities.length} activities (no GPS or indoor)`
    );

    // Build the values placeholders
    const valueGroups: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    validActivities.forEach((activity) => {
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

        const priority = calculatePriority(activity);

        valueGroups.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${
                paramIndex + 3
            }, $${paramIndex + 4}, $${paramIndex + 5})`
        );
        params.push(
            userId,
            message.action,
            message.created,
            message.json_data,
            message.is_webhook,
            priority
        );
        paramIndex += 6;
    });

    if (valueGroups.length > 0) {
        await db.query(
            `INSERT INTO event_queue (user_id, action, created, json_data, is_webhook, priority) VALUES ${valueGroups.join(
                ", "
            )}`,
            params
        );
    }

    return {
        queued: validActivities.length,
        skipped: activities.length - validActivities.length,
    };
};

export default addActivityMessages;
