import Challenge from "../../typeDefs/Challenge";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getChallengeById = async (id: number): Promise<Challenge> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(`SELECT * FROM challenges WHERE id = $1 LIMIT 1`, [id])
    ).rows as Challenge[];

    return rows[0];
};

export default getChallengeById;
