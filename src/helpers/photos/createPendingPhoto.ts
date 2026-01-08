import getCloudSqlConnection from "../getCloudSqlConnection";

export type SummitType = "activity" | "manual";

const assertOwnerForSummit = async (params: {
    summitType: SummitType;
    summitId: string;
    userId: string;
}) => {
    const pool = await getCloudSqlConnection();
    const { summitType, summitId, userId } = params;

    console.log(`[assertOwnerForSummit] summitType=${summitType}, summitId=${summitId}, userId=${userId}`);

    if (summitType === "manual") {
        const res = await pool.query(
            `SELECT user_id FROM user_peak_manual WHERE id = $1 LIMIT 1`,
            [summitId]
        );
        console.log(`[assertOwnerForSummit] manual query returned ${res.rows.length} rows`);
        if (res.rows.length === 0) return false;
        return String(res.rows[0].user_id) === String(userId);
    }

    // summitType === "activity"
    // Verify that the activities_peaks record exists AND that its parent activity belongs to this user.
    // Note: activities.id may be bigint, activities_peaks.activity_id is varchar - use direct comparison
    const res = await pool.query(
        `
        SELECT a.user_id
        FROM activities_peaks ap
        JOIN activities a ON a.id = ap.activity_id
        WHERE ap.id = $1
        LIMIT 1
        `,
        [summitId]
    );

    console.log(`[assertOwnerForSummit] activity query returned ${res.rows.length} rows`, res.rows[0] ?? null);
    if (res.rows.length === 0) return false;
    const isOwner = String(res.rows[0].user_id) === String(userId);
    console.log(`[assertOwnerForSummit] user_id from DB: ${res.rows[0].user_id}, comparing to: ${userId}, isOwner: ${isOwner}`);
    return isOwner;
};

export const createPendingPhoto = async (params: {
    photoId: string;
    userId: string;
    summitType: SummitType;
    summitId: string;
    storagePath: string;
    thumbnailPath: string;
    originalFilename?: string;
    mimeType: string;
}) => {
    const pool = await getCloudSqlConnection();
    const {
        photoId,
        userId,
        summitType,
        summitId,
        storagePath,
        thumbnailPath,
        originalFilename,
        mimeType,
    } = params;

    const isOwner = await assertOwnerForSummit({ summitType, summitId, userId });
    if (!isOwner) {
        // Use 404 semantics (matches API privacy model patterns)
        const err: any = new Error("Summit not found");
        err.statusCode = 404;
        throw err;
    }

    const activitiesPeaksId = summitType === "activity" ? summitId : null;
    const manualId = summitType === "manual" ? summitId : null;

    const res = await pool.query(
        `
        INSERT INTO summit_photos
          (id, activities_peaks_id, user_peak_manual_id, user_id, storage_path, thumbnail_path, original_filename, mime_type)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, storage_path, thumbnail_path
        `,
        [
            photoId,
            activitiesPeaksId,
            manualId,
            userId,
            storagePath,
            thumbnailPath,
            originalFilename ?? null,
            mimeType,
        ]
    );

    return res.rows[0] as {
        id: string;
        storage_path: string;
        thumbnail_path: string | null;
    };
};

export default createPendingPhoto;


