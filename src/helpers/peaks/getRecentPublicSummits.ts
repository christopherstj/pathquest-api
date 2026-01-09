import Summit from "../../typeDefs/Summit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";
import { getPhotosBucket } from "../photos/getPhotosBucket";

export interface SummitPhoto {
    thumbnailUrl: string;
    fullUrl: string;
}

export interface RecentPublicSummit extends Summit {
    user_id?: string;
    user_name?: string;
    peak_id: string;
    peak_name: string;
    summit_type: "activity" | "manual";
    photos?: SummitPhoto[]; // Array of photo objects with thumbnail and full URLs
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
            -- We include summit_type to allow photo lookups without exposing activity_id
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
                    ap.custom_condition_tags,
                    'activity'::text AS summit_type
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
                    custom_condition_tags,
                    'manual'::text AS summit_type
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
                s.summit_type,
                p.name AS peak_name,
                u.id AS user_id,
                u.name AS user_name,
                ARRAY_AGG(
                    CASE 
                        WHEN sp.thumbnail_path IS NOT NULL THEN sp.thumbnail_path
                        ELSE REPLACE(sp.storage_path, '.jpg', '_thumb.jpg')
                    END
                    ORDER BY sp.taken_at DESC NULLS LAST, sp.created_at DESC
                ) FILTER (WHERE sp.id IS NOT NULL) AS photo_thumbnail_paths,
                ARRAY_AGG(
                    sp.storage_path
                    ORDER BY sp.taken_at DESC NULLS LAST, sp.created_at DESC
                ) FILTER (WHERE sp.id IS NOT NULL) AS photo_full_paths
            FROM all_public_summits s
            LEFT JOIN users u ON u.id = s.user_id
            LEFT JOIN peaks p ON p.id = s.peak_id
            LEFT JOIN summit_photos sp ON (
                (s.summit_type = 'activity' AND sp.activities_peaks_id = s.id) OR
                (s.summit_type = 'manual' AND sp.user_peak_manual_id = s.id)
            )
            WHERE u.is_public = TRUE
            GROUP BY s.id, s.timestamp, s.notes, s.is_public, s.temperature, s.precipitation,
                     s.weather_code, s.cloud_cover, s.wind_speed, s.wind_direction, s.humidity,
                     s.difficulty, s.experience_rating, s.timezone, s.condition_tags, s.custom_condition_tags,
                     s.peak_id, s.summit_type, p.name, u.id, u.name
            ORDER BY s.timestamp DESC
            LIMIT $1
        `,
            [limit]
        )
    ).rows as (RecentPublicSummit & { photo_thumbnail_paths?: string[]; photo_full_paths?: string[] })[];

    const convertedRows = convertPgNumbers(rows);
    
    // Generate signed URLs for photos
    const bucket = getPhotosBucket();
    const viewExpiryMs = parseInt(
        process.env.PHOTOS_VIEW_URL_EXPIRES_MS ?? "3600000",
        10
    );
    const expiresAt = Date.now() + (Number.isFinite(viewExpiryMs) ? viewExpiryMs : 3600000);

    const summitsWithPhotos = await Promise.all(
        convertedRows.map(async (row) => {
            const photos: SummitPhoto[] = [];
            const thumbPaths = row.photo_thumbnail_paths ?? [];
            const fullPaths = row.photo_full_paths ?? [];
            
            for (let i = 0; i < Math.min(thumbPaths.length, 4); i++) {
                try {
                    const [thumbnailUrl] = await bucket.file(thumbPaths[i]).getSignedUrl({
                        version: "v4",
                        action: "read",
                        expires: expiresAt,
                    });
                    const [fullUrl] = await bucket.file(fullPaths[i]).getSignedUrl({
                        version: "v4",
                        action: "read",
                        expires: expiresAt,
                    });
                    photos.push({ thumbnailUrl, fullUrl });
                } catch (err) {
                    console.error(`Failed to generate signed URL:`, err);
                }
            }
            
            return {
                ...row,
                photos: photos.length > 0 ? photos : undefined,
            } as RecentPublicSummit;
        })
    );

    return summitsWithPhotos;
};

export default getRecentPublicSummits;


