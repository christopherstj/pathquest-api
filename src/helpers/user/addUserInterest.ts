import getCloudSqlConnection from "../getCloudSqlConnection";

const addUserInterest = async (email: string) => {
    const db = await getCloudSqlConnection();
    await db.query(
        `INSERT INTO user_interest (email, date_registered) VALUES ($1, CURRENT_TIMESTAMP)`,
        [email]
    );

    return { email };
};

export default addUserInterest;
