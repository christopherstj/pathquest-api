// import { FastifyInstance } from "fastify";
// import createUser from "../helpers/user/createUser";
// import Stripe from "stripe";

// const billing = (fastify: FastifyInstance, _: any, done: any) => {
//     fastify.post<{
//         Body: {
//             id: string;
//             name: string;
//             email: string | null;
//             pic: string | null;
//         };
//     }>("/", async (request, reply) => {
//         const { id, name, email, pic } = request.body;

//         await createUser({ id, name, email });

//         return { id, name, email, pic };
//     });

//     done();
// };

// export default billing;
