import getCloudSqlConnection from "../getCloudSqlConnection";

const deleteUser = async (userId: string): Promise<void> => {
    const db = await getCloudSqlConnection();
    const userQuery = `
        DELETE FROM users WHERE id = $1;
    `;
    await db.query(userQuery, [userId]);

    // Note: Activities and related data are deleted via ON DELETE CASCADE foreign key constraints
};

export default deleteUser;
