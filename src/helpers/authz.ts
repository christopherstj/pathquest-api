import { FastifyReply, FastifyRequest } from "fastify";

export const ensureOwner = (
    request: FastifyRequest,
    reply: FastifyReply,
    ownerId?: string | null
) => {
    if (!request.user?.id || !ownerId) {
        reply.code(403).send({ message: "Forbidden" });
        return false;
    }

    if (request.user.id.toString() !== ownerId.toString()) {
        reply.code(403).send({ message: "Forbidden" });
        return false;
    }

    return true;
};

