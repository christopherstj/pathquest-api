import Activity from "../../typeDefs/Activity";
import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";
import getRecentPeakSummits from "../challenges/getRecentPeakSummits";

const getMostRecentSummitByPeak = async (
    peaks: Peak[],
    userId: string
): Promise<{
    peaks: Peak[];
    activityCoords: {
        id: string;
        coords: Activity["coords"];
    }[];
}> => {
    const db = await getCloudSqlConnection();
    const ids = await Promise.all(
        peaks.map(async (p) => {
            const rows = (
                await db.query(
                    `
                        SELECT ap.activity_id AS id
                        FROM (
                            SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public 
                            FROM activities_peaks ap
                            LEFT JOIN activities a ON a.id = ap.activity_id
                            WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                            UNION
                            SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public 
                            FROM user_peak_manual
                        ) ap 
                        WHERE ap.peak_id = $1 AND ap.user_id = $2
                        ORDER BY ap.timestamp DESC 
                        LIMIT 1
                    `,
                    [p.id, userId]
                )
            ).rows as { id: string }[];

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
        const placeholders = distinctIds.map((_, i) => `$${i + 1}`).join(", ");
        const queryString = `SELECT id,
            (SELECT json_agg(json_build_array(ST_X(geom), ST_Y(geom)) ORDER BY path)
             FROM (SELECT (dp).geom, (dp).path FROM ST_DumpPoints(coords::geometry) dp) pts) as coords
            FROM activities WHERE id IN (${placeholders})`;

        const rows = (await db.query(queryString, distinctIds)).rows as {
            coords: Activity["coords"];
            id: string;
        }[];

        const peaksPromises = peaks.map(async (peak) => {
            if (peak.summits === 0)
                return {
                    ...peak,
                    ascents: [],
                };
            const peakSummits = await getRecentPeakSummits(userId, peak.id);

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
