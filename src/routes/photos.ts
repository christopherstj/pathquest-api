import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import createPendingPhoto, { SummitType } from "../helpers/photos/createPendingPhoto";
import getSignedUploadUrl from "../helpers/photos/getSignedUploadUrl";
import completePhotoUpload from "../helpers/photos/completePhotoUpload";
import deletePhoto from "../helpers/photos/deletePhoto";
import updatePhotoCaption from "../helpers/photos/updatePhotoCaption";
import getPhotosBySummit from "../helpers/photos/getPhotosBySummit";
import getPublicPhotosBySummit from "../helpers/photos/getPublicPhotosBySummit";

const SUPPORTED_CONTENT_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
];

const isSupportedContentType = (contentType: string) => {
    return SUPPORTED_CONTENT_TYPES.includes(contentType.toLowerCase());
};

const photos = (fastify: FastifyInstance, _: any, done: any) => {
    // POST /api/photos/upload-url
    fastify.post<{
        Body: {
            filename?: string;
            contentType: string;
            summitType: SummitType;
            summitId: string;
        };
    }>(
        "/upload-url",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user!.id;
            const { filename, contentType, summitType, summitId } = request.body;

            if (!isSupportedContentType(contentType)) {
                reply.code(400).send({
                    message: `Unsupported contentType. Supported: ${SUPPORTED_CONTENT_TYPES.join(", ")}`,
                });
                return;
            }

            if (summitType !== "activity" && summitType !== "manual") {
                reply.code(400).send({ message: "Invalid summitType" });
                return;
            }

            if (!summitId) {
                reply.code(400).send({ message: "Missing summitId" });
                return;
            }

            const photoId = randomUUID();
            const signed = await getSignedUploadUrl({
                userId,
                photoId,
                contentType,
            });

            await createPendingPhoto({
                photoId,
                userId,
                summitType,
                summitId,
                storagePath: signed.storagePath,
                thumbnailPath: signed.thumbnailPath,
                originalFilename: filename,
                mimeType: contentType,
            });

            reply.code(200).send({
                uploadUrl: signed.uploadUrl,
                photoId: signed.photoId,
                storagePath: signed.storagePath,
            });
        }
    );

    // POST /api/photos/:id/complete
    fastify.post<{
        Params: { id: string };
        Body: { width?: number; height?: number; takenAt?: string };
    }>(
        "/:id/complete",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user!.id;
            const { id } = request.params;
            const { width, height, takenAt } = request.body ?? {};

            const result = await completePhotoUpload({
                photoId: id,
                userId,
                width,
                height,
                takenAt,
            });

            reply.code(200).send(result);
        }
    );

    // PUT /api/photos/:id (caption update)
    fastify.put<{
        Params: { id: string };
        Body: { caption?: string | null };
    }>(
        "/:id",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user!.id;
            const { id } = request.params;
            const caption = request.body?.caption ?? null;

            const result = await updatePhotoCaption({
                photoId: id,
                userId,
                caption,
            });

            reply.code(200).send(result);
        }
    );

    // DELETE /api/photos/:id
    fastify.delete<{
        Params: { id: string };
    }>(
        "/:id",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user!.id;
            const { id } = request.params;

            const result = await deletePhoto({ photoId: id, userId });
            reply.code(200).send(result);
        }
    );

    // GET /api/photos/by-summit - Get photos for a specific summit (owner only)
    fastify.get<{
        Querystring: { summitType: string; summitId: string };
    }>(
        "/by-summit",
        { onRequest: [fastify.authenticate] },
        async function (request, reply) {
            const userId = request.user!.id;
            const { summitType, summitId } = request.query;

            if (summitType !== "activity" && summitType !== "manual") {
                reply.code(400).send({ message: "Invalid summitType" });
                return;
            }

            if (!summitId) {
                reply.code(400).send({ message: "Missing summitId" });
                return;
            }

            const result = await getPhotosBySummit({
                summitType: summitType as SummitType,
                summitId,
                userId,
            });
            reply.code(200).send(result);
        }
    );

    // GET /api/photos/by-summit/public - Get public photos for a specific summit (no auth)
    // Used to show photos on public summit cards in the community section
    fastify.get<{
        Querystring: { summitType: string; summitId: string; limit?: string };
    }>(
        "/by-summit/public",
        async function (request, reply) {
            const { summitType, summitId, limit } = request.query;

            if (summitType !== "activity" && summitType !== "manual") {
                reply.code(400).send({ message: "Invalid summitType" });
                return;
            }

            if (!summitId) {
                reply.code(400).send({ message: "Missing summitId" });
                return;
            }

            const result = await getPublicPhotosBySummit({
                summitType: summitType as SummitType,
                summitId,
                limit: limit ? parseInt(limit, 10) : undefined,
            });
            reply.code(200).send(result);
        }
    );

    done();
};

export default photos;


