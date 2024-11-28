import getCloudSqlConnection from "../getCloudSqlConnection";

const addUserInterest = async (email: string) => {
    const connection = await getCloudSqlConnection();

    await connection.execute(
        `INSERT INTO UserInterest (email, dateRegistered) VALUES (?, CURRENT_TIMESTAMP())`,
        [email]
    );

    await connection.end();

    return { email };
};

export default addUserInterest;
