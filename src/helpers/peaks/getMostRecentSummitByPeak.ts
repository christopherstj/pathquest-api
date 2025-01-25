import { RowDataPacket, format } from "mysql2";
import Activity from "../../typeDefs/Activity";
import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";
import getRecentPeakSummits from "../challenges/getRecentPeakSummits";

const getMostRecentSummitByPeak = async (
    peaks: (Peak & {
        isFavorited: boolean;
        isSummitted?: boolean;
    })[],
    userId: string
): Promise<{
    peaks: (Peak & {
        isFavorited: boolean;
        isSummitted?: boolean;
        ascents: { timestamp: string; activityId: string; timezone?: string }[];
    })[];
    activityCoords: {
        id: string;
        coords: Activity["coords"];
    }[];
}> => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    const query = `
        SELECT a.id
        FROM (
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
            UNION
            SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap 
        LEFT JOIN Activity a ON ap.activityId = a.id 
        WHERE ap.peakId IN (${peaks
            .map((p) => `'${p.Id}'`)
            .join(", ")}) AND a.userId = ?
        ORDER BY a.startTime DESC 
    `;

    const [ids] = await connection.query<({ id: string } & RowDataPacket)[]>(
        query,
        [userId]
    );

    const distinctIds = ids
        .map((id) => id.id)
        .filter((id, index, self) => self.indexOf(id) === index);

    if (distinctIds.length > 0) {
        const queryString = `SELECT id, coords FROM Activity WHERE id IN (${distinctIds
            .map((id) => `'${id}'`)
            .join(", ")})`;

        console.log(format(queryString));
        const [rows] = await connection.query<
            ({ coords: Activity["coords"]; id: string } & RowDataPacket)[]
        >(queryString);

        connection.release();

        const peaksPromises = peaks.map(async (peak) => {
            if (!peak.isSummitted)
                return {
                    ...peak,
                    ascents: [],
                };
            const peakSummits = await getRecentPeakSummits(userId, peak.Id);

            console.log(peakSummits);

            return {
                ...peak,
                ascents: peakSummits,
            };
        });

        const peaksToReturn = await Promise.all(peaksPromises);

        return {
            peaks: peaksToReturn,
            activityCoords: rows,
        };
    } else {
        connection.release();
        return {
            peaks: peaks.map((p) => ({ ...p, ascents: [] })),
            activityCoords: [],
        };
    }
};

export default getMostRecentSummitByPeak;
