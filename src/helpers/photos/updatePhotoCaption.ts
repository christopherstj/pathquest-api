import getCloudSqlConnection from "../getCloudSqlConnection";

export const updatePhotoCaption = async (params: {
    photoId: string;
    userId: string;
    caption: string | null;
}) => {
    const pool = await getCloudSqlConnection();
    const { photoId, userId, caption } = params;

    // Owner-only update; use 404 semantics if not owner.
    const res = await pool.query(
        `
        UPDATE summit_photos
        SET caption = $3
        WHERE id = $1 AND user_id = $2
        RETURNING id
        `,
        [photoId, userId, caption]
    );

    if (res.rows.length === 0) {
        const err: any = new Error("Photo not found");
        err.statusCode = 404;
        throw err;
    }

    return { id: photoId, caption };
};

export default updatePhotoCaption;


