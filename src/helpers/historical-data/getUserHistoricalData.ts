import addActivityMessages from "./addActivityMessages";
import checkUserHistoricalData from "./checkUserHistoricalData";
import getNextActivities from "./getNextActivities";
import setHistoricalDataFlag from "./setHistoricalDataFlag";

const getUserHistoricalData = async (userId: string) => {
    const hasProcessedHistoricalData = await checkUserHistoricalData(userId);

    if (hasProcessedHistoricalData === null || hasProcessedHistoricalData) {
        console.log(
            "User has already processed historical data or does not exist"
        );
        return;
    }

    let page = 0;
    let hasMoreData = true;

    while (hasMoreData) {
        page++;
        console.log("Getting page", page);
        const activities = await getNextActivities(userId, page);

        if (activities.length === 0) {
            hasMoreData = false;
        } else {
            await addActivityMessages(activities, userId);
        }
    }

    console.log("Finished getting historical data for", userId);

    await setHistoricalDataFlag(userId, true);
};

export default getUserHistoricalData;
