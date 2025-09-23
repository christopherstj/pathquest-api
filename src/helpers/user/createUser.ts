import db from "../getCloudSqlConnection";

const createUser = async ({
    id,
    name,
    email,
}: {
    id: string;
    name: string;
    email: string | null;
}) => {
    await db.execute(
        `INSERT INTO User (id, name, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, email = ?`,
        [id, name, email, name, email]
    );
};

export default createUser;
