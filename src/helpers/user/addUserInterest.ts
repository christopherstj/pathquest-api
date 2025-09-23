import db from "../getCloudSqlConnection";

const addUserInterest = async (email: string) => {
    await db.execute(
        `INSERT INTO UserInterest (email, dateRegistered) VALUES (?, CURRENT_TIMESTAMP())`,
        [email]
    );

    return { email };
};

export default addUserInterest;
