import getCloudSqlConnection from "../getCloudSqlConnection";
import { getPhotosBucket } from "./getPhotosBucket";

export type PublicPeakPhoto = {
    id: string;
    thumbnailUrl: string;
    fullUrl: string;
    caption: string | null;
    takenAt: string | null;
    userName: string | null;
};

export interface PeakPhotosResult {
    photos: PublicPeakPhoto[];
    nextCursor: string | null;
    totalCount: number;
}

export interface PeakPhotosFilters {
    /** ISO timestamp cursor for pagination */
    cursor?: string;
    /** Max photos per page (default 20, max 100) */
    limit?: number;
}

/**
 * Get public photos for a peak with cursor-based pagination.
 * Returns paginated photos ordered by taken_at DESC (most recent first).
 */
export const getPhotosByPeak = async (params: {
    peakId: string;
    filters?: PeakPhotosFilters;
}): Promise<PeakPhotosResult> => {
    const pool = await getCloudSqlConnection();
    const { peakId, filters = {} } = params;
    const { cursor, limit = 20 } = filters;

    const safeLimit =
        Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 20;

    const queryParams: (string | number)[] = [peakId];
    let paramIndex = 2;

    // Build cursor clause for pagination
    let cursorClause = "";
    if (cursor) {
        cursorClause = `AND (sp.taken_at < $${paramIndex}::timestamptz OR (sp.taken_at IS NULL AND sp.created_at < $${paramIndex}::timestamptz))`;
        queryParams.push(cursor);
        paramIndex++;
    }

    // Get total count (only on first page to avoid expensive count on every page)
    let totalCount = 0;
    if (!cursor) {
        const countRes = await pool.query(
            `
            SELECT COUNT(*) as count
            FROM summit_photos sp
            JOIN users u ON u.id = sp.user_id AND u.is_public = true
            LEFT JOIN activities_peaks ap ON ap.id = sp.activities_peaks_id
            LEFT JOIN user_peak_manual upm ON upm.id = sp.user_peak_manual_id
            WHERE
              (
                sp.activities_peaks_id IS NOT NULL
                AND ap.peak_id = $1
                AND ap.is_public = true
              )
              OR
              (
                sp.user_peak_manual_id IS NOT NULL
                AND upm.peak_id = $1
                AND upm.is_public = true
              )
            `,
            [peakId]
        );
        totalCount = parseInt(countRes.rows[0]?.count || "0", 10);
    }

    // Add limit param
    queryParams.push(safeLimit);
    const limitParam = `$${paramIndex}`;

    // Public photos: only from public summits AND public users.
    const res = await pool.query(
        `
        SELECT
          sp.id,
          sp.storage_path,
          sp.thumbnail_path,
          sp.caption,
          sp.taken_at,
          sp.created_at,
          u.name AS user_name
        FROM summit_photos sp
        JOIN users u ON u.id = sp.user_id AND u.is_public = true
        LEFT JOIN activities_peaks ap ON ap.id = sp.activities_peaks_id
        LEFT JOIN user_peak_manual upm ON upm.id = sp.user_peak_manual_id
        WHERE
          (
            sp.activities_peaks_id IS NOT NULL
            AND ap.peak_id = $1
            AND ap.is_public = true
          )
          OR
          (
            sp.user_peak_manual_id IS NOT NULL
            AND upm.peak_id = $1
            AND upm.is_public = true
          )
          ${cursorClause}
        ORDER BY sp.taken_at DESC NULLS LAST, sp.created_at DESC
        LIMIT ${limitParam}::integer
        `,
        queryParams
    );

    const bucket = getPhotosBucket();
    const viewExpiryMs = parseInt(process.env.PHOTOS_VIEW_URL_EXPIRES_MS ?? "3600000", 10);
    const expiresAt = Date.now() + (Number.isFinite(viewExpiryMs) ? viewExpiryMs : 3600000);

    const photos = await Promise.allSettled(
        res.rows.map(async (row) => {
            const storagePath = String(row.storage_path);
            const thumbnailPath = row.thumbnail_path
                ? String(row.thumbnail_path)
                : `${storagePath.replace(/\.jpg$/i, "")}_thumb.jpg`;

            const [fullUrl] = await bucket.file(storagePath).getSignedUrl({
                version: "v4",
                action: "read",
                expires: expiresAt,
            });
            const [thumbnailUrl] = await bucket.file(thumbnailPath).getSignedUrl({
                version: "v4",
                action: "read",
                expires: expiresAt,
            });

            return {
                id: String(row.id),
                thumbnailUrl,
                fullUrl,
                caption: row.caption ?? null,
                takenAt: row.taken_at ? new Date(row.taken_at).toISOString() : null,
                // Use taken_at for cursor, fall back to created_at
                _cursorValue: row.taken_at 
                    ? new Date(row.taken_at).toISOString() 
                    : new Date(row.created_at).toISOString(),
                userName: row.user_name ?? null,
            };
        })
    );

    // Filter out failed promises and log errors
    const successfulPhotos = photos
        .filter((result): result is PromiseFulfilledResult<PublicPeakPhoto & { _cursorValue: string }> => {
            if (result.status === "rejected") {
                console.error("Failed to generate signed URL for photo:", result.reason);
                return false;
            }
            return true;
        })
        .map((result) => result.value);

    // Determine next cursor (timestamp of last item if we got a full page)
    const nextCursor = successfulPhotos.length === safeLimit && successfulPhotos.length > 0
        ? successfulPhotos[successfulPhotos.length - 1]._cursorValue
        : null;

    // Strip internal cursor value from response
    const cleanPhotos: PublicPeakPhoto[] = successfulPhotos.map(({ _cursorValue, ...photo }) => photo);

    return { 
        photos: cleanPhotos, 
        nextCursor, 
        totalCount 
    };
};

export default getPhotosByPeak;


