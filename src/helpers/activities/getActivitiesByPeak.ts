import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";
import Activity from "../../typeDefs/Activity";

const getActivityByPeak = async (
    peakId: string,
    userId: string,
    justCoords: boolean = false
) => {
    const [rows] = await db.query<(Activity & RowDataPacket)[]>(
        `SELECT DISTINCT a.id, a.\`name\`, a.userId, a.startLat, a.startLong, a.distance, a.coords, a.startTime, a.sport, a.timezone, a.gain${
            !justCoords ? ", a.vertProfile, a.distanceStream, a.timeStream" : ""
        } FROM ActivityPeak ap LEFT JOIN Activity a ON ap.activityId = a.id WHERE ap.peakId = ? AND a.userId = ?`,
        [peakId, userId]
    );

    return rows;
};

export default getActivityByPeak;
