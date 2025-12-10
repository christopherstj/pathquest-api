import ManualPeakSummit from "../../typeDefs/ManualPeakSummit";
import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getRecentSummits = async (
    userId: string
): Promise<(Peak & ManualPeakSummit)[]> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `
        SELECT 
            ap.id,
            ap.user_id,
            ap.peak_id,
            ap.activity_id,
            ap.timestamp::text as timestamp,
            ap.notes,
            ap.is_public,
            ap.difficulty,
            ap.experience_rating,
            p.name,
            p.elevation::float as elevation,
            p.county,
            p.state,
            p.country,
            ST_X(p.location_coords::geometry)::float as lng,
            ST_Y(p.location_coords::geometry)::float as lat
        FROM (
            SELECT a1.user_id, ap1.id, ap1.timestamp, ap1.activity_id, ap1.peak_id, ap1.notes, ap1.is_public, ap1.difficulty, ap1.experience_rating 
            FROM activities_peaks ap1
            LEFT JOIN activities a1 ON ap1.activity_id = a1.id
            UNION
            SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public, difficulty, experience_rating 
            FROM user_peak_manual
        ) ap
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE ap.user_id = $1
        ORDER BY ap.timestamp DESC
        LIMIT 100;    
    `,
            [userId]
        )
    ).rows as (Peak & ManualPeakSummit)[];

    return rows;
};

export default getRecentSummits;
