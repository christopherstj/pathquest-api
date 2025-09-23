import { RowDataPacket } from "mysql2";
import db from "../getCloudSqlConnection";
import User from "../../typeDefs/User";

const getPublicUserProfile = async (userId: string) => {
    const [rows] = await db.query<({ isPublic: boolean } & RowDataPacket)[]>(
        `
        SELECT isPublic FROM User WHERE id = ?
    `,
        [userId]
    );

    const isPublic = rows.length > 0 ? rows[0].isPublic : false;

    if (isPublic) {
        const [profileRows] = await db.query<(User & RowDataPacket)[]>(
            `SELECT id, 
        \`name\`, 
        pic,
        city,
        state,
        country,
        lat,
        \`long\`,
        isSubscribed = 1 isSubscribed,
        isLifetimeFree = 1 isLifetimeFree
        FROM User WHERE id = ? LIMIT 1`,
            [userId]
        );

        return profileRows[0];
    } else {
        return null;
    }
};

export default getPublicUserProfile;
