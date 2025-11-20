import getCloudSqlConnection from "../getCloudSqlConnection";
import Challenge from "../../typeDefs/Challenge";

const getChallenges = async (
    page: number,
    perPage: number,
    search?: string
) => {
    const db = await getCloudSqlConnection();
    const skip = (page - 1) * perPage;

    if (search) {
        const rows = (
            await db.query(
                `SELECT c.*, COUNT(pc.peak_id) AS num_peaks FROM challenges c LEFT JOIN peaks_challenges pc ON c.id = pc.challenge_id
            WHERE LOWER(name) LIKE $1
            GROUP BY c.id
            ORDER BY name ASC LIMIT $2 OFFSET $3`,
                [`%${search.toLocaleLowerCase()}%`, perPage, skip]
            )
        ).rows as Challenge[];

        return rows;
    } else {
        const rows = (
            await db.query(
                `SELECT c.*, COUNT(pc.peak_id) AS num_peaks FROM challenges c LEFT JOIN peak_challenge pc ON c.id = pc.challenge_id
            GROUP BY c.id
            ORDER BY name ASC LIMIT $1 OFFSET $2`,
                [perPage, skip]
            )
        ).rows as Challenge[];

        return rows;
    }
};

export default getChallenges;
