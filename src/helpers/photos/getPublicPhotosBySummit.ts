import getCloudSqlConnection from "../getCloudSqlConnection";
import { getPhotosBucket } from "./getPhotosBucket";

// Define SummitType locally (API doesn't use @pathquest/shared)
type SummitType = "activity" | "manual";

export type PublicSummitPhoto = {
    id: string;
    thumbnailUrl: string;
    fullUrl: string;
    caption: string | null;
    takenAt: string | null;
};

export interface PublicSummitPhotosResult {
    photos: PublicSummitPhoto[];
}

/**
 * Get public photos for a specific summit.
 * Only returns photos if the summit is public and the user is public.
 * This is used to show photos on public summit cards in the community section.
 */
export const getPublicPhotosBySummit = async (params: {
    summitType: SummitType;
    summitId: string;
    limit?: number;
}): Promise<PublicSummitPhotosResult> => {
    const pool = await getCloudSqlConnection();
    const { summitType, summitId, limit = 10 } = params;

    const safeLimit =
        Number.isFinite(limit) && limit > 0 && limit <= 20 ? limit : 10;

    // Build query based on summit type
    // We need to verify the summit is public AND the user is public
    let query: string;
    if (summitType === "activity") {
        query = `
            SELECT
                sp.id,
                sp.storage_path,
                sp.thumbnail_path,
                sp.caption,
                sp.taken_at
            FROM summit_photos sp
            JOIN activities_peaks ap ON ap.id = sp.activities_peaks_id
            JOIN activities a ON a.id = ap.activity_id
            JOIN users u ON u.id = a.user_id
            WHERE sp.activities_peaks_id = $1
              AND ap.is_public = true
              AND u.is_public = true
            ORDER BY sp.taken_at DESC NULLS LAST, sp.created_at DESC
            LIMIT $2
        `;
    } else {
        query = `
            SELECT
                sp.id,
                sp.storage_path,
                sp.thumbnail_path,
                sp.caption,
                sp.taken_at
            FROM summit_photos sp
            JOIN user_peak_manual upm ON upm.id = sp.user_peak_manual_id
            JOIN users u ON u.id = upm.user_id
            WHERE sp.user_peak_manual_id = $1
              AND upm.is_public = true
              AND u.is_public = true
            ORDER BY sp.taken_at DESC NULLS LAST, sp.created_at DESC
            LIMIT $2
        `;
    }

    const res = await pool.query(query, [summitId, safeLimit]);

    if (res.rows.length === 0) {
        return { photos: [] };
    }

    const bucket = getPhotosBucket();
    const viewExpiryMs = parseInt(
        process.env.PHOTOS_VIEW_URL_EXPIRES_MS ?? "3600000",
        10
    );
    const expiresAt =
        Date.now() + (Number.isFinite(viewExpiryMs) ? viewExpiryMs : 3600000);

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
                takenAt: row.taken_at
                    ? new Date(row.taken_at).toISOString()
                    : null,
            } satisfies PublicSummitPhoto;
        })
    );

    // Filter out failed promises and log errors
    const successfulPhotos = photos
        .filter(
            (result): result is PromiseFulfilledResult<PublicSummitPhoto> => {
                if (result.status === "rejected") {
                    console.error(
                        "Failed to generate signed URL for photo:",
                        result.reason
                    );
                    return false;
                }
                return true;
            }
        )
        .map((result) => result.value);

    return { photos: successfulPhotos };
};

export default getPublicPhotosBySummit;

