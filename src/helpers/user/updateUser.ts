import getCloudSqlConnection from "../getCloudSqlConnection";

const updateUser = async (
    userId: string,
    userData: Partial<{
        name?: string;
        email?: string;
        pic?: string;
    }>
) => {
    const db = await getCloudSqlConnection();

    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(userData)) {
        if (value === undefined) continue;
        fields.push(`${key} = $${index}`);
        values.push(value);
        index++;
    }

    if (fields.length === 0) {
        return;
    }

    values.push(userId);

    const query = `
        UPDATE users
        SET ${fields.join(", ")}
        WHERE id = $${index};
    `;

    await db.query(query, values);
};

export default updateUser;
