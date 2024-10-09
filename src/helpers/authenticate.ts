import { FastifyReply, FastifyRequest } from "fastify";
import { decode } from "next-auth/jwt";

const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.authorization) {
        try {
            const token = request.headers.authorization.replace("Bearer ", "");
            const decoded = await decode({
                token,
                secret: process.env.JWT_SECRET ?? "",
            });
            if (!decoded) {
                reply.code(401).send({ message: "Unauthorized" });
            }
            // request.user = {
            //     ...decoded,
            // };
        } catch (error) {
            console.error(error);
            reply.code(401).send({ message: "Unauthorized" });
        }
    } else {
        reply.code(401).send({ message: "Unauthorized" });
    }
};

export default authenticate;
