import getActivityById from "./getActivityById";
import getSummitsByActivity, { SummitWithPeak } from "./getSummitsByActivity";
import Activity from "../../typeDefs/Activity";

export interface ActivityDetails {
    activity: Activity | null;
    summits: SummitWithPeak[];
}

const getActivityDetails = async (activityId: string): Promise<ActivityDetails> => {
    const [activity, summits] = await Promise.all([
        getActivityById(activityId),
        getSummitsByActivity(activityId),
    ]);

    return {
        activity,
        summits,
    };
};

export default getActivityDetails;
