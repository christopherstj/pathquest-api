import { RowDataPacket } from "mysql2/promise";
import getCloudSqlConnection from "../getCloudSqlConnection";
import Challenge from "../../typeDefs/Challenge";

const getChallenges = async (
    page: number,
    perPage: number,
    search?: string
) => {
    const connection = await getCloudSqlConnection();

    const skip = (page - 1) * perPage;

    if (search) {
        const [rows] = await connection.query<(Challenge & RowDataPacket)[]>(
            `SELECT c.*, COUNT(pc.peakId) numPeaks FROM Challenge c LEFT JOIN PeakChallenge pc ON c.id = pc.challengeId
            WHERE LOWER(\`name\`) LIKE CONCAT('%', ?, '%') 
            GROUP BY c.id
            ORDER BY \`name\` ASC LIMIT ? OFFSET ?`,
            [search.toLocaleLowerCase(), perPage, skip]
        );

        await connection.release();

        return rows;
    } else {
        const [rows] = await connection.query<(Challenge & RowDataPacket)[]>(
            `SELECT c.*, COUNT(pc.peakId) numPeaks FROM Challenge c LEFT JOIN PeakChallenge pc ON c.id = pc.challengeId
            GROUP BY c.id
            ORDER BY \`name\` ASC LIMIT ? OFFSET ?`,
            [perPage, skip]
        );

        await connection.release();

        return rows;
    }
};

export default getChallenges;
