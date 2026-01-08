import getCloudSqlConnection from "../getCloudSqlConnection";
import { getPhotosBucket } from "./getPhotosBucket";
import { SummitType } from "./createPendingPhoto";

export type SummitPhoto = {
    id: string;
    thumbnailUrl: string;
    fullUrl: string;
    caption: string | null;
    takenAt: string | null;
};

export const getPhotosBySummit = async (params: {
    summitType: SummitType;
    summitId: string;
    userId: string;
}): Promise<{ photos: SummitPhoto[] }> => {
    const pool = await getCloudSqlConnection();
    const { summitType, summitId, userId } = params;

    const where =
        summitType === "manual"
            ? "sp.user_peak_manual_id = $1"
            : "sp.activities_peaks_id = $1";

    const res = await pool.query(
        `
        SELECT id, storage_path, thumbnail_path, caption, taken_at
        FROM summit_photos sp
        WHERE ${where} AND sp.user_id = $2
        ORDER BY sp.taken_at DESC NULLS LAST, sp.created_at DESC
        `,
        [summitId, userId]
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
            } satisfies SummitPhoto;
        })
    );

    // Filter out failed promises and log errors
    const successfulPhotos = photos
        .filter((result): result is PromiseFulfilledResult<SummitPhoto> => {
            if (result.status === "rejected") {
                console.error("Failed to generate signed URL for photo:", result.reason);
                return false;
            }
            return true;
        })
        .map((result) => result.value);

    return { photos: successfulPhotos };
};

export default getPhotosBySummit;


