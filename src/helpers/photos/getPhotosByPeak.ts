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

export const getPhotosByPeak = async (params: {
    peakId: string;
    limit?: number;
}): Promise<{ photos: PublicPeakPhoto[] }> => {
    const pool = await getCloudSqlConnection();
    const { peakId, limit = 50 } = params;

    const safeLimit =
        Number.isFinite(limit) && limit > 0 && limit <= 200 ? limit : 50;

    // Public photos: only from public summits AND public users.
    // activities_peaks path:
    //  - filter ap.is_public = true
    //  - filter users.is_public = true
    // manual path:
    //  - filter upm.is_public = true
    //  - filter users.is_public = true
    const res = await pool.query(
        `
        SELECT
          sp.id,
          sp.storage_path,
          sp.thumbnail_path,
          sp.caption,
          sp.taken_at,
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
        ORDER BY sp.taken_at DESC NULLS LAST, sp.created_at DESC
        LIMIT $2
        `,
        [peakId, safeLimit]
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
                userName: row.user_name ?? null,
            } satisfies PublicPeakPhoto;
        })
    );

    // Filter out failed promises and log errors
    const successfulPhotos = photos
        .filter((result): result is PromiseFulfilledResult<PublicPeakPhoto> => {
            if (result.status === "rejected") {
                // Log but don't fail the entire request
                console.error("Failed to generate signed URL for photo:", result.reason);
                return false;
            }
            return true;
        })
        .map((result) => result.value);

    return { photos: successfulPhotos };
};

export default getPhotosByPeak;


