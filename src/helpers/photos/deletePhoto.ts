import getCloudSqlConnection from "../getCloudSqlConnection";
import { getPhotosBucket } from "./getPhotosBucket";

export const deletePhoto = async (params: { photoId: string; userId: string }) => {
    const pool = await getCloudSqlConnection();
    const { photoId, userId } = params;

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

    // Delete objects first (best-effort), then delete DB record.
    const bucket = getPhotosBucket();
    await bucket.file(photo.storage_path).delete({ ignoreNotFound: true });
    if (photo.thumbnail_path) {
        await bucket.file(photo.thumbnail_path).delete({ ignoreNotFound: true });
    }

    await pool.query(`DELETE FROM summit_photos WHERE id = $1`, [photoId]);

    return { id: photoId };
};

export default deletePhoto;


