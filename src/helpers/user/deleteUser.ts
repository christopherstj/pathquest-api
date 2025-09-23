import db from "../getCloudSqlConnection";

const deleteUser = async (userId: string): Promise<void> => {
    const userQuery = `
        DELETE FROM \`User\` WHERE id = ?;
    `;
    await db.execute(userQuery, [userId]);

    // Note: Activities and related data are deleted via ON DELETE CASCADE foreign key constraints
};

export default deleteUser;
