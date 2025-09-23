import { RowDataPacket } from "mysql2/promise";
import User from "../../typeDefs/User";
import db from "../getCloudSqlConnection";

const getUser = async (userId: string) => {
    const [rows] = await db.query<(User & RowDataPacket)[]>(
        `SELECT u.id, 
        u.\`name\`, 
        u.email,
        u.pic,
        u.updateDescription = 1 updateDescription,
        u.city,
        u.state,
        u.country,
        u.lat,
        u.\`long\`,
        u.units,
        u.isSubscribed = 1 isSubscribed,
        u.isLifetimeFree = 1 isLifetimeFree,
        u.historicalDataProcessed = 1 historicalDataProcessed,
        COUNT(eq.id) as processingActivityCount
        FROM \`User\` u
        LEFT JOIN (
            SELECT id, userId FROM EventQueue WHERE userId = ? AND completed IS NULL AND attempts < 5
        ) eq ON eq.userId = u.id
        WHERE u.id = ?
        GROUP BY u.id
        LIMIT 1;`,
        [userId, userId]
    );

    const user = rows[0];

    return user;
};

export default getUser;
