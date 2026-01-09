import Summit from "../../typeDefs/Summit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";
import { getPhotosBucket } from "../photos/getPhotosBucket";

interface SummitPhoto {
    thumbnailUrl: string;
    fullUrl: string;
}

// Extended summit type with user info for public display
interface PublicSummit extends Summit {
    user_id?: string;
    user_name?: string;
    summit_type: "activity" | "manual";
    photos?: SummitPhoto[];
}

export interface PublicSummitsResult {
    summits: PublicSummit[];
    nextCursor: string | null;
    totalCount: number;
}

export interface PublicSummitsFilters {
    cursor?: string; // ISO timestamp for pagination
    limit?: number;
}

/**
 * Get public summits for a peak with cursor-based pagination
 * Returns paginated summits ordered by timestamp DESC (most recent first)
 */
const getPublicSummitsByPeakCursor = async (
    peakId: string,
    filters: PublicSummitsFilters = {}
): Promise<PublicSummitsResult> => {
    const db = await getCloudSqlConnection();
    const { cursor, limit = 20 } = filters;
    
    const params: (string | number)[] = [peakId];
    let paramIndex = 2;
    
    // Build WHERE clause for cursor pagination
    const cursorClause = cursor 
        ? `AND ap.timestamp < $${paramIndex}::timestamptz`
        : "";
    if (cursor) {
        params.push(cursor);
        paramIndex++;
    }
    
    // Get total count (for first page only, to avoid expensive count on every page)
    let totalCount = 0;
    if (!cursor) {
        const countResult = await db.query<{ count: string }>(
            `
            SELECT COUNT(*) as count
            FROM (
                SELECT a.user_id, ap.id, ap.timestamp, ap.peak_id, ap.notes, ap.is_public, ap.temperature, ap.precipitation, ap.weather_code, ap.cloud_cover, ap.wind_speed, ap.wind_direction, ap.humidity, ap.difficulty, ap.experience_rating, a.timezone, ap.condition_tags, ap.custom_condition_tags, 'activity'::text AS summit_type
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, id, timestamp, peak_id, notes, is_public, temperature, precipitation, weather_code, cloud_cover, wind_speed, wind_direction, humidity, difficulty, experience_rating, timezone, condition_tags, custom_condition_tags, 'manual'::text AS summit_type
                FROM user_peak_manual
            ) ap
            LEFT JOIN users u ON u.id = ap.user_id
            WHERE peak_id = $1
            AND ap.is_public = TRUE
            AND u.is_public = TRUE
            `,
            [peakId]
        );
        totalCount = parseInt(countResult.rows[0]?.count || "0", 10);
    }
    
    // Get paginated summits
    const limitParam = `$${paramIndex}`;
    params.push(limit);
    paramIndex++;
    
    const rows = (
        await db.query(
            `
            -- Note: activity_id intentionally excluded to comply with Strava API guidelines
            -- Strava data can only be shown to the activity owner, not other users
            -- We include summit_type to allow photo lookups without exposing activity_id
            SELECT 
                ap.id, 
                ap.timestamp, 
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
                ap.timezone,
                ap.condition_tags,
                ap.custom_condition_tags,
                ap.summit_type,
                u.id as user_id,
                u.name as user_name,
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
            FROM (
                SELECT a.user_id, ap.id, ap.timestamp, ap.peak_id, ap.notes, ap.is_public, ap.temperature, ap.precipitation, ap.weather_code, ap.cloud_cover, ap.wind_speed, ap.wind_direction, ap.humidity, ap.difficulty, ap.experience_rating, a.timezone, ap.condition_tags, ap.custom_condition_tags, 'activity'::text AS summit_type
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, id, timestamp, peak_id, notes, is_public, temperature, precipitation, weather_code, cloud_cover, wind_speed, wind_direction, humidity, difficulty, experience_rating, timezone, condition_tags, custom_condition_tags, 'manual'::text AS summit_type
                FROM user_peak_manual
            ) ap
            LEFT JOIN users u ON u.id = ap.user_id
            LEFT JOIN summit_photos sp ON (
                (ap.summit_type = 'activity' AND sp.activities_peaks_id = ap.id) OR
                (ap.summit_type = 'manual' AND sp.user_peak_manual_id = ap.id)
            )
            WHERE ap.peak_id = $1
            AND ap.is_public = TRUE
            AND u.is_public = TRUE
            ${cursorClause}
            GROUP BY ap.id, ap.timestamp, ap.notes, ap.is_public, ap.temperature, ap.precipitation,
                     ap.weather_code, ap.cloud_cover, ap.wind_speed, ap.wind_direction, ap.humidity,
                     ap.difficulty, ap.experience_rating, ap.timezone, ap.condition_tags, ap.custom_condition_tags,
                     ap.summit_type, u.id, u.name
            ORDER BY ap.timestamp DESC
            LIMIT ${limitParam}::integer
            `,
            params
        )
    ).rows as (PublicSummit & { photo_thumbnail_paths?: string[]; photo_full_paths?: string[] })[];

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
            } as PublicSummit;
        })
    );
    
    // Determine next cursor (timestamp of last item if we got a full page)
    const nextCursor = summitsWithPhotos.length === limit && summitsWithPhotos.length > 0
        ? summitsWithPhotos[summitsWithPhotos.length - 1].timestamp
        : null;
    
    return {
        summits: summitsWithPhotos,
        nextCursor,
        totalCount,
    };
};

export default getPublicSummitsByPeakCursor;





