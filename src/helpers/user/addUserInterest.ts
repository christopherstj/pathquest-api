import getCloudSqlConnection from "../getCloudSqlConnection";

const addUserInterest = async (email: string) => {
    const pool = await getCloudSqlConnection();

    const connection = await pool.getConnection();

    await connection.execute(
        `INSERT INTO UserInterest (email, dateRegistered) VALUES (?, CURRENT_TIMESTAMP())`,
        [email]
    );

    connection.release();

    return { email };
};

export default addUserInterest;
