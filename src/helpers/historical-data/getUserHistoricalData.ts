import addActivityMessages from "./addActivityMessages";
import getNextActivities from "./getNextActivities";

const getUserHistoricalData = async (userId: string) => {
    let page = 0;
    let hasMoreData = true;

    while (hasMoreData) {
        page++;
        console.log("Getting page", page);
        const activities = await getNextActivities(userId, page);

        if (activities.length === 0) {
            hasMoreData = false;
        } else {
            await addActivityMessages(activities);
        }
    }

    console.log("Finished getting historical data for", userId);
};

export default getUserHistoricalData;
