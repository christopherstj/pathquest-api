import getCloudSqlConnection from "../getCloudSqlConnection";

const createUser = async ({
    id,
    name,
    email,
}: {
    id: string;
    name: string;
    email: string | null;
}) => {
    console.log("Creating or updating user:", { id, name, email });
    const db = await getCloudSqlConnection();
    await db.query(
        `INSERT INTO users (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $4, email = $5`,
        [id, name, email, name, email]
    );
};

export default createUser;
