import { RowDataPacket } from "mysql2/promise";
import User from "../../typeDefs/User";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUser = async (userId: string) => {
    const pool = await getCloudSqlConnection();
    console.log("got user pool");

    const connection = await pool.getConnection();
    console.log("got user connection");

    const [rows] = await connection.query<(User & RowDataPacket)[]>(
        `SELECT id, 
        \`name\`, 
        email,
        pic,
        updateDescription = 1 updateDescription,
        city,
        state,
        country,
        lat,
        \`long\`,
        units,
        isSubscribed = 1 isSubscribed,
        isLifetimeFree = 1 isLifetimeFree
        FROM User WHERE id = ? LIMIT 1`,
        [userId]
    );

    const user = rows[0];

    console.log("got user rows");

    connection.release();

    console.log("released user connection");

    return user;
};

export default getUser;
