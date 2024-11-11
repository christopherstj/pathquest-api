import { RowDataPacket, format } from "mysql2";
import Activity from "../../typeDefs/Activity";
import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getMostRecentSummitByPeak = async (
    peaks: (Peak & {
        isFavorited: boolean;
        isSummitted?: boolean;
    })[],
    userId: string
): Promise<
    {
        peak: Peak & {
            isFavorited: boolean;
            isSummitted?: boolean;
        };
        activity?: Activity;
    }[]
> => {
    const promises = peaks.map(async (peak) => {
        if (peak.isSummitted) {
            const connection = await getCloudSqlConnection();

            const query = `
                SELECT (
                    CASE 
                    WHEN a.id IS NOT NULL THEN CONCAT("SELECT * FROM Activity WHERE id = ", a.id) ELSE NULL
                    END
                ) queryString
                FROM ActivityPeak ap 
                LEFT JOIN Activity a ON ap.activityId = a.id 
                WHERE ap.peakId = ? AND a.userId = ?
                ORDER BY a.startTime DESC 
                LIMIT 1
            `;

            const [queryStrings] = await connection.query<
                ({ queryString: string } & RowDataPacket)[]
            >(query, [peak.Id, userId]);

            if (queryStrings.length > 0 && queryStrings[0]) {
                const { queryString } = queryStrings[0];
                const [rows] = await connection.query<
                    (Activity & RowDataPacket)[]
                >(queryString);

                await connection.end();

                return {
                    peak,
                    activity: rows[0] || undefined,
                };
            } else {
                await connection.end();

                return {
                    peak,
                    activity: undefined,
                };
            }
        }
        return {
            peak,
            activity: undefined,
        };
    });

    return Promise.all(promises);
};

export default getMostRecentSummitByPeak;
