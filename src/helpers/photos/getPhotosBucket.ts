import { Storage } from "@google-cloud/storage";

let storage: Storage | undefined;

export const getPhotosBucketName = () =>
    process.env.PHOTOS_BUCKET_NAME ?? "pathquest-photos";

export const getPhotosStorage = () => {
    if (!storage) {
        storage = new Storage();
    }
    return storage;
};

export const getPhotosBucket = () => {
    return getPhotosStorage().bucket(getPhotosBucketName());
};

export const buildPhotoPaths = (userId: string, photoId: string) => {
    // Sanitize paths to prevent directory traversal
    // userId comes from authenticated request, but validate anyway
    // Allow alphanumeric, hyphens, underscores (UUIDs contain hyphens)
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    // photoId is UUID format: allow alphanumeric and hyphens
    const safePhotoId = photoId.replace(/[^a-zA-Z0-9-]/g, "");
    
    if (!safeUserId || !safePhotoId || safeUserId !== userId || safePhotoId !== photoId) {
        const err: any = new Error("Invalid userId or photoId format");
        err.statusCode = 400;
        throw err;
    }
    
    const base = `photos/${safeUserId}/${safePhotoId}`;
    return {
        storagePath: `${base}.jpg`,
        thumbnailPath: `${base}_thumb.jpg`,
    };
};


