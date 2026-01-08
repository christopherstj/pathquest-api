import sharp from "sharp";

export type ProcessedImageResult = {
    originalJpeg: Buffer;
    thumbnailJpeg: Buffer;
};

const TARGET_ORIGINAL_MAX_BYTES = 2 * 1024 * 1024; // ~2MB

const compressToTarget = async (input: Buffer): Promise<Buffer> => {
    // Start reasonably high quality and step down if we exceed the target.
    const qualities = [82, 75, 68, 60, 52, 45];

    try {
        for (const quality of qualities) {
            const out = await sharp(input)
                .rotate()
                .jpeg({
                    quality,
                    mozjpeg: true,
                })
                .toBuffer();

            if (out.byteLength <= TARGET_ORIGINAL_MAX_BYTES) {
                return out;
            }
        }

        // Return the most compressed attempt
        return await sharp(input)
            .rotate()
            .jpeg({
                quality: 45,
                mozjpeg: true,
            })
            .toBuffer();
    } catch (error) {
        const err: any = new Error("Invalid image file");
        err.statusCode = 400;
        err.cause = error;
        throw err;
    }
};

export const generateThumbnail = async (params: {
    original: Buffer;
    thumbWidth?: number;
}): Promise<ProcessedImageResult> => {
    const { original, thumbWidth = 400 } = params;

    try {
        // Privacy: do NOT preserve metadata (Sharp strips metadata unless withMetadata() is used)
        const originalJpeg = await compressToTarget(original);

        const thumbnailJpeg = await sharp(originalJpeg)
            .rotate()
            .resize({ width: thumbWidth, withoutEnlargement: true })
            .jpeg({ quality: 72, mozjpeg: true })
            .toBuffer();

        return { originalJpeg, thumbnailJpeg };
    } catch (error) {
        // Re-throw if it's already our custom error
        if ((error as any).statusCode) {
            throw error;
        }
        const err: any = new Error("Failed to process image");
        err.statusCode = 400;
        err.cause = error;
        throw err;
    }
};

export default generateThumbnail;


