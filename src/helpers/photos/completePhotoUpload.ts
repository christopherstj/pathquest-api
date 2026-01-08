import getCloudSqlConnection from "../getCloudSqlConnection";
import { getPhotosBucket } from "./getPhotosBucket";
import generateThumbnail from "./generateThumbnail";

const toOptionalDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (typeof value === "string" || value instanceof Date) {
        const d = new Date(value as any);
        return Number.isFinite(d.getTime()) ? d : null;
    }
    return null;
};

export const completePhotoUpload = async (params: {
    photoId: string;
    userId: string;
    width?: number;
    height?: number;
    takenAt?: string;
}) => {
    const pool = await getCloudSqlConnection();
    const { photoId, userId, width, height, takenAt } = params;

    const photoRes = await pool.query(
        `SELECT id, user_id, storage_path, thumbnail_path FROM summit_photos WHERE id = $1 LIMIT 1`,
        [photoId]
    );
    if (photoRes.rows.length === 0) {
        const err: any = new Error("Photo not found");
        err.statusCode = 404;
        throw err;
    }

    const photo = photoRes.rows[0] as {
        id: string;
        user_id: string;
        storage_path: string;
        thumbnail_path: string | null;
    };

    if (String(photo.user_id) !== String(userId)) {
        const err: any = new Error("Photo not found");
        err.statusCode = 404;
        throw err;
    }

    const bucket = getPhotosBucket();
    const originalFile = bucket.file(photo.storage_path);

    const [originalExists] = await originalFile.exists();
    if (!originalExists) {
        const err: any = new Error("Uploaded file not found");
        err.statusCode = 400;
        throw err;
    }

    const [originalBuffer] = await originalFile.download();

    // Validate upload size (client may upload large files with PUT)
    const maxUploadBytes = parseInt(process.env.PHOTOS_MAX_UPLOAD_BYTES ?? `${10 * 1024 * 1024}`, 10);
    if (Number.isFinite(maxUploadBytes) && originalBuffer.byteLength > maxUploadBytes) {
        // Clean up the too-large object
        await originalFile.delete({ ignoreNotFound: true });
        const err: any = new Error("File too large");
        err.statusCode = 413;
        throw err;
    }

    let originalJpeg: Buffer;
    let thumbnailJpeg: Buffer;
    try {
        const processed = await generateThumbnail({
            original: originalBuffer,
            thumbWidth: parseInt(process.env.PHOTOS_THUMB_WIDTH ?? "400", 10) || 400,
        });
        originalJpeg = processed.originalJpeg;
        thumbnailJpeg = processed.thumbnailJpeg;
    } catch (error) {
        // Clean up the uploaded file if processing fails
        await originalFile.delete({ ignoreNotFound: true });
        throw error;
    }

    // Overwrite original with compressed JPEG (also strips metadata)
    await originalFile.save(originalJpeg, {
        resumable: false,
        contentType: "image/jpeg",
        metadata: {
            cacheControl: "private, max-age=0",
        },
    });

    const thumbnailPath =
        photo.thumbnail_path ?? `${photo.storage_path.replace(/\.jpg$/i, "")}_thumb.jpg`;
    const thumbFile = bucket.file(thumbnailPath);
    await thumbFile.save(thumbnailJpeg, {
        resumable: false,
        contentType: "image/jpeg",
        metadata: {
            cacheControl: "private, max-age=0",
        },
    });

    const takenAtDate = toOptionalDate(takenAt);

    await pool.query(
        `
        UPDATE summit_photos
        SET
          thumbnail_path = $2,
          size_bytes = $3,
          width = COALESCE($4, width),
          height = COALESCE($5, height),
          taken_at = COALESCE($6, taken_at)
        WHERE id = $1
        `,
        [
            photoId,
            thumbnailPath,
            originalJpeg.byteLength,
            Number.isFinite(width as any) ? width : null,
            Number.isFinite(height as any) ? height : null,
            takenAtDate,
        ]
    );

    const viewExpiryMs = parseInt(process.env.PHOTOS_VIEW_URL_EXPIRES_MS ?? "3600000", 10); // 1h
    const [thumbnailUrl] = await thumbFile.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + (Number.isFinite(viewExpiryMs) ? viewExpiryMs : 3600000),
    });

    return { id: photoId, thumbnailUrl };
};

export default completePhotoUpload;


