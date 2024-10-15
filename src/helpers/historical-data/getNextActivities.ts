import ListActivity from "../../typeDefs/ListActivity";
import checkRateLimit from "../checkRateLimit";
import getStravaAccessToken from "../getStravaAccessToken";
import setUsageData from "../setUsageData";

const getNextActivities = async (userId: string, page: number) => {
    const hasCapacity = await checkRateLimit();

    if (!hasCapacity) {
        console.error("Rate limit reached");
        return [];
    }

    const token = await getStravaAccessToken(userId);

    const activities = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    await setUsageData(activities.headers);

    if (!activities.ok) {
        console.error("Failed to get activities", await activities.text());
        return [];
    } else {
        const data: ListActivity[] = await activities.json();
        return data;
    }
};

export default getNextActivities;
