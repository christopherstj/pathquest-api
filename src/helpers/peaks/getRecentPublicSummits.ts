import Summit from "../../typeDefs/Summit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";

export interface RecentPublicSummit extends Summit {
    user_id?: string;
    user_name?: string;
    peak_id: string;
    peak_name: string;
}

/**
 * Returns most recent public summits across the entire community.
 *
 * Notes:
 * - Excludes denied summits (auto-detections rejected by the user).
 * - Excludes summits from private users.
 * - Does NOT expose activity_id (Strava compliance).
 */
const getRecentPublicSummits = async (
    limit: number = 5
): Promise<RecentPublicSummit[]> => {
    const db = await getCloudSqlConnection();

    const rows = (
        await db.query(
            `
            -- Note: activity_id intentionally excluded to comply with Strava API guidelines
            -- Strava data can only be shown to the activity owner, not other users
            WITH all_public_summits AS (
                SELECT 
                    a.user_id,
                    ap.id,
                    ap.timestamp,
                    ap.peak_id,
                    ap.notes,
                    ap.is_public,
                    ap.temperature,
                    ap.precipitation,
                    ap.weather_code,
                    ap.cloud_cover,
                    ap.wind_speed,
                    ap.wind_direction,
                    ap.humidity,
                    ap.difficulty,
                    ap.experience_rating,
                    a.timezone,
                    ap.condition_tags,
                    ap.custom_condition_tags
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE ap.is_public = TRUE
                  AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'

                UNION ALL

                SELECT
                    user_id,
                    id,
                    timestamp,
                    peak_id,
                    notes,
                    is_public,
                    temperature,
                    precipitation,
                    weather_code,
                    cloud_cover,
                    wind_speed,
                    wind_direction,
                    humidity,
                    difficulty,
                    experience_rating,
                    timezone,
                    condition_tags,
                    custom_condition_tags
                FROM user_peak_manual
                WHERE is_public = TRUE
            )
            SELECT
                s.id,
                s.timestamp,
                s.notes,
                s.is_public,
                s.temperature,
                s.precipitation,
                s.weather_code,
                s.cloud_cover,
                s.wind_speed,
                s.wind_direction,
                s.humidity,
                s.difficulty,
                s.experience_rating,
                s.timezone,
                s.condition_tags,
                s.custom_condition_tags,
                s.peak_id,
                p.name AS peak_name,
                u.id AS user_id,
                u.name AS user_name
            FROM all_public_summits s
            LEFT JOIN users u ON u.id = s.user_id
            LEFT JOIN peaks p ON p.id = s.peak_id
            WHERE u.is_public = TRUE
            ORDER BY s.timestamp DESC
            LIMIT $1
        `,
            [limit]
        )
    ).rows as RecentPublicSummit[];

    return convertPgNumbers(rows);
};

export default getRecentPublicSummits;


