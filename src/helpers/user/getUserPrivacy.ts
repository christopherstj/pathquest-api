import { RowDataPacket } from "mysql2";
import db from "../getCloudSqlConnection";

const getUserPrivacy = async (userId: string) => {
    const query = `
        SELECT isPublic FROM \`User\` WHERE id = ?
    `;

    const [rows] = await db.query<({ isPublic: boolean } & RowDataPacket)[]>(
        query,
        [userId]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0].isPublic;
};

export default getUserPrivacy;
