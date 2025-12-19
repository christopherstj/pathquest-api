import ManualPeakSummit from "../../typeDefs/ManualPeakSummit";
import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

export interface RecentSummit extends Peak, ManualPeakSummit {
    hasReport: boolean;
    summitNumber: number;
}

const getRecentSummits = async (
    userId: string
): Promise<RecentSummit[]> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `
        WITH all_summits AS (
            SELECT 
                ap1.id,
                a1.user_id,
                ap1.peak_id,
                ap1.activity_id,
                ap1.timestamp,
                ap1.notes,
                ap1.is_public,
                ap1.difficulty,
                ap1.experience_rating,
                a1.timezone
            FROM activities_peaks ap1
            LEFT JOIN activities a1 ON ap1.activity_id = a1.id
            WHERE a1.user_id = $1
              AND COALESCE(ap1.confirmation_status, 'auto_confirmed') != 'denied'
            UNION ALL
            SELECT 
                id,
                user_id,
                peak_id,
                activity_id,
                timestamp,
                notes,
                is_public,
                difficulty,
                experience_rating,
                timezone
            FROM user_peak_manual
            WHERE user_id = $1
        ),
        numbered_summits AS (
            SELECT 
                *,
                ROW_NUMBER() OVER (ORDER BY timestamp ASC) as summit_number
            FROM all_summits
        )
        SELECT 
            ns.id,
            ns.user_id,
            ns.peak_id,
            ns.activity_id,
            ns.timestamp::text as timestamp,
            ns.notes,
            ns.is_public,
            ns.difficulty,
            ns.experience_rating,
            ns.timezone,
            p.name,
            p.elevation::float as elevation,
            p.county,
            p.state,
            p.country,
            ST_X(p.location_coords::geometry)::float as lng,
            ST_Y(p.location_coords::geometry)::float as lat,
            (ns.notes IS NOT NULL AND TRIM(ns.notes) != '' OR ns.difficulty IS NOT NULL OR ns.experience_rating IS NOT NULL) as has_report,
            ns.summit_number::int as summit_number
        FROM numbered_summits ns
        LEFT JOIN peaks p ON ns.peak_id = p.id
        ORDER BY ns.timestamp DESC
        LIMIT 100;    
    `,
            [userId]
        )
    ).rows;

    // Map the results to include properly named fields
    return rows.map((row: any) => ({
        ...row,
        hasReport: row.has_report,
        summitNumber: row.summit_number,
    }));
};

export default getRecentSummits;
