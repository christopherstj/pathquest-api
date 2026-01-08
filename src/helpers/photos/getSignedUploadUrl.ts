import { buildPhotoPaths, getPhotosBucket, getPhotosStorage } from "./getPhotosBucket";

export type SignedUploadUrlResult = {
    uploadUrl: string;
    photoId: string;
    storagePath: string;
    thumbnailPath: string;
};

export const getSignedUploadUrl = async (params: {
    userId: string;
    photoId: string;
    contentType: string;
}): Promise<SignedUploadUrlResult> => {
    const { userId, photoId, contentType } = params;

    const { storagePath, thumbnailPath } = buildPhotoPaths(userId, photoId);
    const bucket = getPhotosBucket();

    // Ensure bucket exists early (gives clearer errors in dev)
    const [bucketExists] = await getPhotosStorage().bucket(bucket.name).exists();
    if (!bucketExists) {
        const err: any = new Error(`Bucket ${bucket.name} does not exist`);
        err.statusCode = 500;
        throw err;
    }

    const expiresMs = parseInt(process.env.PHOTOS_UPLOAD_URL_EXPIRES_MS ?? "900000", 10); // 15 min
    const [uploadUrl] = await bucket.file(storagePath).getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + (Number.isFinite(expiresMs) ? expiresMs : 900000),
        contentType,
    });

    return {
        uploadUrl,
        photoId,
        storagePath,
        thumbnailPath,
    };
};

export default getSignedUploadUrl;


