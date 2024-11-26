import PeakSummit from "../../typeDefs/PeakSummit";
import getActivityById from "./getActivityById";
import getPeaksByActivity from "./getPeaksByActivity";
import getSummitsByPeakAndActivity from "./getSummitsByPeakAndActivity";

const getActivityDetails = async (activityId: string) => {
    const peakIds = await getPeaksByActivity(activityId);

    const promises = peakIds.map(async (peak): Promise<PeakSummit> => {
        const ascents = await getSummitsByPeakAndActivity(peak.Id, activityId);

        return {
            ...peak,
            ascents: ascents.map((a) => ({ ...a, activityId })),
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
