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
        ascents: {
            id: string;
            timestamp: string;
            activityId: string;
            timezone?: string;
        }[];
    })[];
    activityCoords: {
        id: string;
        coords: Activity["coords"];
    }[];
}> => {
    const pool = await getCloudSqlConnection();

    const ids = await Promise.all(
        peaks.map(async (p) => {
            const connection = await pool.getConnection();

            const [rows] = await connection.query<
                ({ id: string } & RowDataPacket)[]
            >(
                format(
                    `
                SELECT a.id
                FROM (
                    SELECT id, timestamp, activityId, peakId, notes, isPublic FROM ActivityPeak
                    UNION
                    SELECT id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
                    WHERE userId = ?
                ) ap 
                LEFT JOIN Activity a ON ap.activityId = a.id 
                WHERE ap.peakId = ? AND a.userId = ?
                ORDER BY a.startTime DESC 
                LIMIT 1
            `,
                    [userId, p.Id, userId]
                )
            );

            connection.release();

            if (rows.length === 0) {
                return null;
            }

            return rows[0].id;
        })
    );

    const distinctIds = ids.filter(
        (id, index, self) => id !== null && self.indexOf(id) === index
    );

    if (distinctIds.length > 0) {
        const connection = await pool.getConnection();

        const queryString = `SELECT id, coords FROM Activity WHERE id IN (${distinctIds
            .map((id) => `'${id}'`)
            .join(", ")})`;

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
        return {
            peaks: peaks.map((p) => ({ ...p, ascents: [] })),
            activityCoords: [],
        };
    }
};

export default getMostRecentSummitByPeak;
