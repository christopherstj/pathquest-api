import getCloudSqlConnection from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeakSummitsByUser = async (
    userId: string,
    includePrivate: boolean = false
): Promise<Peak[]> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query<Peak>(
            `
        SELECT 
            p.id,
            p.name,
            p.elevation,
            p.county,
            p.state,
            p.country,
            p.type,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] AS location_coords
        FROM (
            SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public 
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION
            SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public 
            FROM user_peak_manual
        ) ap 
        LEFT JOIN peaks p ON ap.peak_id = p.id 
        WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        GROUP BY p.id;
    `,
            [userId, includePrivate]
        )
    ).rows;

    const promises = rows.map(async (row): Promise<Peak> => {
        const ascents = (
            await db.query<{
                id: string;
                timestamp: string;
                activity_id: string;
                timezone?: string;
            }>(
                `
            SELECT ap.id, timestamp, activity_id, ap.timezone
            FROM (
                SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public, a.timezone 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public, timezone 
                FROM user_peak_manual
            ) ap
            WHERE peak_id = $1 
            AND (ap.is_public = true OR $2)
            AND ap.user_id = $3
        `,
                [row.id, includePrivate, userId]
            )
        ).rows;

        return {
            ...row,
            ascents,
        };
    });

    const peakSummits = await Promise.all(promises);

    return peakSummits;
};

export default getPeakSummitsByUser;
