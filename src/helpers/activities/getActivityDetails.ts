import Peak from "../../typeDefs/Peak";
import getActivityById from "./getActivityById";
import getPeaksByActivity from "./getPeaksByActivity";
import getSummitsByPeakAndActivity from "./getSummitsByPeakAndActivity";

const getActivityDetails = async (activityId: string) => {
    const peakIds = await getPeaksByActivity(activityId);

    const promises = peakIds.map(async (peak): Promise<Peak> => {
        const ascents = await getSummitsByPeakAndActivity(peak.id, activityId);

        return {
            ...peak,
            ascents: ascents.map((a) => ({ ...a, activity_id: activityId })),
        };
    });

    const peakSummits = await Promise.all(promises);

    const activity = await getActivityById(activityId);

    return {
        activity,
        peakSummits,
    };
};

export default getActivityDetails;
