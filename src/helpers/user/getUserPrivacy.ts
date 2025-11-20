import getCloudSqlConnection from "../getCloudSqlConnection";

const getUserPrivacy = async (userId: string) => {
    const db = await getCloudSqlConnection();
    const query = `
        SELECT is_public FROM users WHERE id = $1
    `;

    const rows = (await db.query(query, [userId])).rows as {
        is_public: boolean;
    }[];

    if (rows.length === 0) {
        return null;
    }

    return rows[0].is_public;
};

export default getUserPrivacy;
