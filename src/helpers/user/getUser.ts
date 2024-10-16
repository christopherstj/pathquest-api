import { RowDataPacket } from "mysql2/promise";
import User from "../../typeDefs/User";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getUser = async (userId: string) => {
    const connection = await getCloudSqlConnection();

    const [rows] = await connection.query<(User & RowDataPacket)[]>(
        "SELECT * FROM User WHERE id = ? LIMIT 1",
        [userId]
    );

    const user = rows[0];

    return user;
};

export default getUser;
